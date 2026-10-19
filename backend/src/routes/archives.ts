
/*These are the archive structure endpoints
When structures.structure_type is "arkivförtechning", the nodes are handled here.
still not sure if routs should be archive or archives, or some and some??
 */

import express, { type Request, type RequestHandler, type Response } from 'express';
import type{Knex} from 'knex';
import { loadStructure} from '../ead/loadStructure';
import {findArkivforteckningStructures, getNodeTypeIdByCode, 
        parentAllowsChild,} from '../repos/archiveRepo';
import {logChange} from '../util/auditLog';
import{fetchNode, isDescendant, upsertProperties} from '../util/nodeHelpers';
import type {AuthedRequest} from '../middleware/auth'

//This interface just describes the object passed from server.tsinto the 
// router factory (makeArchivesRouter{db, requireRole}) to check that server.ts is passing 
//the right shape and route handlers inside the file get db and requireRole typed as should be.
export interface ArchiveDeps {
    db:Knex;
    requireRole : (role?:string)=> RequestHandler;

}


/*
NodeBody describes the shape of req.body for POST / PUT (title, parentId, description, validFrom, etc...). 
To be able to write body.title without complaints, and so the compiler catches 
typos like body.titel. Total AI suggestion!
*/

interface NodeBody{
    title?:string;
    parentId?: number;
    description?: string|null;
    referenceCode?: string|null;
    sortOrder?: number;
    isPublished?: boolean;
    validFrom?: string|null;
    validTo?: string|null;
    portalUrl?:string|null;
    properties?:Record<string, string|number |boolean |null>;
}

const isPos = (num:number):boolean =>Number.isInteger(num) && num >0;
type ArkivforteckningResult= 
|{ok: true, structuredId:number} | {ok:false; status:404|409; body:Record<string, unknown>};

async function resolveArkivforteckning(
  db: Knex,
  archiveId: number,
): Promise<ArkivforteckningResult> {
  const lookup = await findArkivforteckningStructures(db, archiveId);
  if (lookup.kind === 'none') {
    return { ok: false, status: 404, body: { error:'Arkivet har ingen arkivförteckning' } };
  }
  if (lookup.kind === 'many'){
    return {
      ok: false, status: 409,
      body: {
        error: 'Arkivet använder flera arkivförteckningar. Välj en.',
        structureIds: lookup.ids,
      },
    };
  }
  return { ok: true, structuredId: lookup.id };
}

export function makeArchivesRouter({ db, requireRole }: Deps) {
  const r = express.Router();

  //GET /archives/tree
  //Returns every published archive with its tree.

  r.get('/archives/tree', async (_req: Request, res: Response, next) => {
    try {
      const archives = await db('archives')
        .where({ is_published: true })
        .select(
          'id', 'reference_code as referenceCode', 'name',
          'start_year as startYear', 'end_year as endYear',
        );
      const out: Array<{ archive: unknown; tree: unknown[]; note?: string }> = [];
      for (const a of archives) {
        const lookup = await findArkivforteckningStructures(db, a.id);
        if (lookup.kind !== 'one') {
          out.push({ archive: a, tree: [], note: lookup.kind });
          continue;
        }
        const loaded = await loadStructure(db, lookup.id, { publicOnly: true });
        out.push({ archive: a, tree: loaded?.roots ?? [] });
      }
      res.json({ archives: out });
    } catch (err) { next(err); }
  });

  //GET /archives/:archiveId/series/:seriesId 
  //One series node with metadata, properties and relations.

  r.get('/archives/:archiveId/series/:seriesId', async (req: Request, res: Response, next) => {
    try {
      const archiveId = Number(req.params.archiveId);
      const seriesId  = Number(req.params.seriesId);
      if (!isPos(archiveId) || !isPos(seriesId)) {
        return void res.status(400).json({ error: 'Ogiltigt id' });
      }
      const lookup = await resolveArkivforteckning(db, archiveId);
      if (!lookup.ok) return void res.status(lookup.status).json(lookup.body);
      const structureId = lookup.structuredId;

      const node = await fetchNode(db, structureId, seriesId);
      if (!node) {
        return void res.status(404).json({ error: 'Serien finns inte i arkivet' });
      }
      const relations = await db('node_relations as r')
        .join('relation_types as rt', 'rt.id', 'r.relation_type_id')
        .join('nodes as t', 't.id', 'r.to_node_id')
        .where('r.from_node_id', seriesId)
        .select(
          'r.id', 'rt.code', 'rt.name',
          't.id as targetId', 't.title as targetTitle',
          't.reference_code as targetReferenceCode',
        );
      res.json({ ...node, relations });
    } catch (err) { next(err); }
  });

  //POST /archive/:archiveId/series
  // NOTE:singular "/archive/" was the original specification in design doc. 
  //Returns  code 201 with the created node.

  r.post('/archive/:archiveId/series', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const archiveId = Number(req.params.archiveId);
    if (!isPos(archiveId)) {
      return void res.status(400).json({ error: 'Ogiltigt archiveId' });
    }
    const body = (req.body ?? {}) as NodeBody;
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return void res.status(400).json({ error: 'title krävs (F3.1)' });
    }
    if (!isPos(body.parentId as number)) {
      return void res.status(400).json({ error: 'parentId krävs (F6.1.2)' });
    }

    try {
      const lookup = await resolveArkivforteckning(db, archiveId);
      if (!lookup.ok) return void res.status(lookup.status).json(lookup.body);
      const structureId = lookup.structuredId;

      const serieTypeId = await getNodeTypeIdByCode(db, 'serie');
      if (!serieTypeId) {
        return void res.status(500).json({ error: 'node_type "serie" saknas' });
      }
      const parent = await db('nodes')
        .where({ id: body.parentId as number, structure_id: structureId })
        .first<{ node_type_id: number }>('node_type_id');
      if (!parent) {
        return void res.status(400).json({ error: 'Föräldern finns inte i arkivförteckningen' });
      }
      if (!(await parentAllowsChild(db, parent.node_type_id, serieTypeId))) {
        return void res.status(400).json({ error: 'node_type_rules tillåter inte serie under den föräldern' });
      }

      const userId = req.user?.id ?? null;
      const newId = await db.transaction(async (tx) => {
        const inserted = await tx('nodes').insert({
          structure_id: structureId,
          parent_id: body.parentId,
          node_type_id: serieTypeId,
          reference_code: body.referenceCode ?? null,
          title: body.title,
          sort_order: body.sortOrder ?? 0,
          is_published: Boolean(body.isPublished),
          valid_from: body.validFrom ?? null,
          valid_to: body.validTo ?? null,
          description: body.description ?? null,
          portal_url: body.portalUrl ?? null,
          created_by: userId,
          updated_by: userId,
        }, ['id']) as Array<{ id: number }>;
        const id = inserted[0]!.id;

        if (body.properties) await upsertProperties(tx, id, body.properties, userId);
        await logChange(tx, {
          entityType: 'node', entityId: id, structureId,
          action: 'create', oldValue: null,
          newValue: { ...body, id }, userId,
        });
        return id;
      });

      res.status(201).json(await fetchNode(db, structureId, newId));
    } catch (err) { next(err); }
  });

  //PUT /archives/:archiveId/series/:seriesId
  //The route first resolves the archive's arkivförteckning (using archiveId), 
  // then looks up the node by seriesId inside that specific structure(why both ids are needed and why the route can't be 
  // shortened really. If the client sends parentId, the route checks for cycles (isDescendant) 
  // and parent-type rules (parentAllowsChild) before allowing the move. Then, in one go, it patches only 
  // the fields that were sent, "upserts" any properties, and writes a change_log row. 
  // Then it returns the refreshed node via fetchNode, so the frontend gets the updated series object.

  r.put('/archives/:archiveId/series/:seriesId', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const archiveId = Number(req.params.archiveId);
    const seriesId  =Number(req.params.seriesId);
    if (!isPos(archiveId) || !isPos(seriesId)) {
      return void res.status(400).json({ error: 'Ogiltigt id' });
    }
    const body= (req.body ?? {}) as NodeBody;
    if(body.title !== undefined && (typeof body.title !=='string' || body.title.trim() === '')) {
      return void res.status(400).json({ error: 'Title får inte vara tomt.' });
    }

    try {
      const lookup = await resolveArkivforteckning(db, archiveId);
      if (!lookup.ok) return void res.status(lookup.status).json(lookup.body);
      const structureId = lookup.structuredId;

      const before = await db('nodes')
        .where({ id: seriesId, structure_id:structureId })
        .first();
      if (!before) return void res.status(404).json({ error: 'Serien finns inte'});

      if (body.parentId !== undefined){
        if (!isPos(body.parentId)){
          return void res.status(400).json({ error: 'parentId måste vara ett positivt heltal.' });
        }
        if (body.parentId === seriesId) {
          return void res.status(400).json({ error: 'En nod kan inte vara sin egen förälder.' });
        }
        if (await isDescendant(db, seriesId, body.parentId)) {
          return void res.status(400).json({ error: 'Flytten skulle skapa en cirkelreferens' }); //This goes up to the root to check curcularity!
        }
        const parent = await db('nodes')
          .where({ id: body.parentId, structure_id: structureId })
          .first<{ node_type_id: number }>('node_type_id');
        if (!parent) {
          return void res.status(400).json({ error: 'Föräldern finns inte i arkivförteckningen.' });
        }
        if (!(await parentAllowsChild(db, parent.node_type_id, before.node_type_id))) {
          return void res.status(400).json({ error: 'Flytten är inte tillåten.' });
        }
      }

      const userId = req.user?.id ?? null;
      const patch: Record<string, unknown > = {};
      if (body.title !== undefined) patch.title = body.title;
      
      if (body.parentId !== undefined) patch.parent_id = body.parentId;
      if (body.description !== undefined)patch.description = body.description;
      if (body.isPublished !== undefined) patch.is_published = Boolean(body.isPublished);
      if (body.referenceCode!== undefined) patch.reference_code = body.referenceCode;
      if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
      if (body.validFrom !== undefined) patch.valid_from = body.validFrom;
      if (body.validTo !== undefined) patch.valid_to = body.validTo;
      if (body.portalUrl!== undefined) patch.portal_url= body.portalUrl;

      const isPublishFlip = body.isPublished !== undefined &&
        Boolean(body.isPublished) !== Boolean(before.is_published);
      const action = isPublishFlip ? (body.isPublished ? 'publish' : 'unpublish'): 'update';

      await db.transaction(async (tx) => {
        if (Object.keys(patch).length) {
          patch.updated_by = userId;
          await tx('nodes').where({ id: seriesId }).update(patch);
        }
        if (body.properties) await upsertProperties(tx, seriesId, body.properties, userId);
        await logChange(tx,{
          entityType: 'node', entityId: seriesId, structureId,
          action, oldValue: before, newValue: { ...before, ...patch }, userId,
        });
      });
      res.json(await fetchNode(db, structureId, seriesId));
    } catch (err) { next(err); }
  });

  //DELETE /archives/:archiveId/series/:seriesId 

  r.delete('/archives/:archiveId/series/:seriesId', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const archiveId = Number(req.params.archiveId);
    const seriesId= Number(req.params.seriesId);
    if (!isPos(archiveId) || !isPos(seriesId)) {
      return void res.status(400).json({ error:'Ogiltigt id' });
    }

    try {
      const lookup = await resolveArkivforteckning(db, archiveId);
      if (!lookup.ok) return void res.status( lookup.status).json(lookup.body);
      const structureId = lookup.structuredId;

      const before = await db('nodes')
        .where({id: seriesId, structure_id: structureId }).first();
      if (!before) return void res.status(404).json({ error: 'Serien finns inte'});

      const child = await db('nodes').where({ parent_id: seriesId }).first('id');
      if (child) {
        return void res.status(409).json({
          error: 'Noden har barn och får inte raderas. Radera barnen först.',
        });
      }
      const rels = await db('node_relations')
        .where({ from_node_id: seriesId }).orWhere({ to_node_id: seriesId })
        .select('id', 'from_node_id as fromNodeId','to_node_id as toNodeId');
      if (rels.length) {
        return void res.status(409).json({
          error: 'Noden har relationer och får inte raderas. Ta bort relationerna först.',
          relations: rels,
        });
      }

      const userId = req.user?.id ?? null;
      await db.transaction(async (tx) =>{
        await tx('node_property_values').where({ node_id: seriesId }).del();
        await tx('nodes').where({ id: seriesId }).del();
        await logChange(tx, {
          entityType: 'node', entityId: seriesId, structureId,
          action: 'delete', oldValue: before, newValue: null, userId,
        });
      });
      res.json(before);
    } catch (err) { next(err); }
  });

  //GET /archives/:archiveId/series/:seriesId/volumes 

  r.get('/archives/:archiveId/series/:seriesId/volumes', async(req: Request, res: Response, next) =>{
    try {
      const archiveId = Number(req.params.archiveId);
      const seriesId  = Number(req.params.seriesId);
      if(!isPos(archiveId) || !isPos(seriesId)) {
        return void res.status(400).json({ error: 'Ogiltigt id'});
      }
      const lookup = await resolveArkivforteckning(db, archiveId);
      if (!lookup.ok) return void res.status(lookup.status).json(lookup.body);
      const structureId = lookup.structuredId;

      // Verifying that the series belongs to the structure! 

      const series = await db('nodes')
        .where({ id: seriesId, structure_id: structureId })
        .first('id');
      if (!series) return void res.status(404).json({ error: 'Serien finns inte i arkivet' });

      const volumes= await db('nodes as n')
        .join('node_types as nt', 'nt.id', 'n.node_type_id')
        .where('n.parent_id', seriesId)
        .where('nt.code', 'volym')
        .orderBy([{ column: 'n.sort_order' }, { column: 'n.id' }])
        .select(
          'n.id', 'n.reference_code as referenceCode', 'n.title',
          'n.description', 'n.valid_from as validFrom', 'n.valid_to as validTo',
          'n.portal_url as portalUrl', 'n.sort_order as sortOrder',
          'n.is_published as isPublished',
        );
      res.json({ volumes });
    } catch (err) { next(err); }
  });

  //POST /archives/:archiveId/series/:seriesId/volumes 
  //parent Id forced to seriesId  === this is so that the client cannot choose a different parent!

  r.post('/archives/:archiveId/series/:seriesId/volumes', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const archiveId = Number(req.params.archiveId);
    const seriesId  = Number(req.params.seriesId);
    if (!isPos(archiveId) || !isPos(seriesId)) {
      return void res.status(400).json({ error: 'Ogiltigt id'});
    }
    const body = (req.body ?? {}) as NodeBody;
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return void res.status(400).json({ error: 'Title krävs' });
    }

    try {
      const lookup = await resolveArkivforteckning(db, archiveId);
      if (!lookup.ok) return void res.status(lookup.status).json(lookup.body);
      const structureId = lookup.structuredId;

      const series = await db('nodes')
        .where({ id: seriesId, structure_id: structureId })
        .first<{ node_type_id: number }>('node_type_id');
      if (!series) return void res.status(404).json({ error:'Serien finns inte i arkivet' });

      const volymTypeId = await getNodeTypeIdByCode(db,'volym');
      if (!volymTypeId) {
        return void res.status(500).json({ error: 'node_type "volym" saknas'});
      }
      if (!(await parentAllowsChild(db, series.node_type_id, volymTypeId))) {
        return void res.status(400).json({ error: 'node_type_rules tillåter inte volym under den serien' });
      }

      const userId = req.user?.id ?? null;
      const newId = await db.transaction(async (tx)=> {
        const inserted = await tx('nodes').insert({
          structure_id: structureId,
          parent_id: seriesId,          // forced by route
          node_type_id: volymTypeId,
          reference_code: body.referenceCode ?? null,
          title: body.title,
          sort_order: body.sortOrder ?? 0,
          is_published: Boolean(body.isPublished),
          valid_from: body.validFrom ?? null,
          valid_to: body.validTo ?? null,
          description: body.description ?? null,
          portal_url: body.portalUrl ?? null,
          created_by: userId,
          updated_by: userId,
        }, ['id']) as Array<{ id: number }>;
        const id = inserted[0]!.id;

        if (body.properties) await upsertProperties(tx,id, body.properties, userId);
        await logChange(tx, {
          entityType: 'node', entityId: id, structureId,
          action: 'create', oldValue: null,
          newValue: { ...body, id, parentId: seriesId }, userId,
        });
        return id;
      });
      res.status(201).json(await fetchNode(db, structureId, newId));
    } catch (err) { next(err); }
  });

  //PUT /archives/volumes/:volumeId 
  // parentId is not accepted here, volume always lives
  // directly under its series and moving it is out of scope for the endpoint.

  r.put('/archives/volumes/:volumeId', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const volumeId = Number(req.params.volumeId);
    if (!isPos(volumeId)) {
      return void res.status(400).json({ error: 'Ogiltigt id' });
    }
    const body =(req.body ?? {}) as NodeBody;
    if (body.title !== undefined && (typeof body.title !=='string' || body.title.trim() === '')) {
      return void res.status(400).json({ error: 'title får inte vara tomt om det skickas' });
    }

    try {
      const before = await db('nodes').where({ id: volumeId }).first();
      if (!before) return void res.status(404).json({ error: 'Volymen finns inte' });
      const structureId = before.structure_id as number;

      const userId = req.user?.id ?? null;
      const patch: Record<string, unknown> = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.description !== undefined) patch.description = body.description;
      if (body.isPublished !== undefined) patch.is_published = Boolean(body.isPublished);
      if (body.referenceCode !== undefined) patch.reference_code = body.referenceCode;
      if (body.sortOrder !== undefined) patch.sort_order = body.sortOrder;
      if (body.validFrom !== undefined) patch.valid_from = body.validFrom;
      if (body.validTo !== undefined) patch.valid_to = body.validTo;
      if (body.portalUrl !== undefined) patch.portal_url = body.portalUrl;

      const isPublishFlip =
        body.isPublished !== undefined &&
        Boolean(body.isPublished) !== Boolean(before.is_published);
      const action = isPublishFlip
        ? (body.isPublished ? 'publish' : 'unpublish')
        : 'update';

      await db.transaction(async (tx)=> {
        if (Object.keys(patch).length) {
          patch.updated_by = userId;
          await tx('nodes').where({ id: volumeId }).update(patch);
        }
        if(body.properties) await upsertProperties(tx, volumeId, body.properties, userId);
        await logChange(tx, {
          entityType: 'node', entityId: volumeId, structureId,
          action, oldValue: before, newValue: { ...before, ...patch}, userId,
        });
      });

      res.json(await fetchNode(db, structureId, volumeId));
    } catch (err) { next(err); }
  });

  // DELETE /archives/volumes/:volumeId 
  r.delete('/archives/volumes/:volumeId', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const volumeId = Number(req.params.volumeId);
    if (!isPos(volumeId)) {
      return void res.status(400).json({ error: 'Ogiltigt id.' });
    }
    try {
      const before = await db('nodes').where({ id: volumeId }).first();
      if (!before) return void res.status(404).json({ error: 'Volymen finns inte.' });
      const structureId = before.structure_id as number;

      const child = await db('nodes').where({ parent_id: volumeId }).first('id');
      if (child) {
        return void res.status(409).json({
          error: 'Noden har barn och får inte raderas. Radera barnen först.',
        });
      }
      const rels = await db('node_relations')
        .where({ from_node_id: volumeId }).orWhere({ to_node_id: volumeId })
        .select('id', 'from_node_id as fromNodeId', 'to_node_id as toNodeId');
      if (rels.length) {
        return void res.status(409).json({
          error: 'Noden har relationer och får inte raderas. Ta bort relationerna först.',
          relations: rels,
        });
      }

      const userId = req.user?.id ?? null;
      await db.transaction(async (tx) => {
        await tx('node_property_values').where({ node_id: volumeId }).del();
        await tx('nodes').where({ id: volumeId }).del();
        await logChange(tx, {
          entityType: 'node', entityId: volumeId, structureId,
          action: 'delete', oldValue: before, newValue: null, userId,
        });
      });

      res.json(before);
    } catch (err) { next(err); }
  });

  return r;
}
