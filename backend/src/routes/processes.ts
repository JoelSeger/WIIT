/* 
Classification-structure endpoints. Handles nodes inside a tree
when structures.structure_type ='klassificering'.

Node types are: verksamhetsomrade > processgrupp > process > handlingstyp.
node_type_rules enforces the order in the DB.

Every write is one db.transaction that includes the change_log row.
Response shape: bare node objectn
("Returns the created/updated/deleted object").
*/
/*
Body shape for POST/PUT:
{
    title: string,
    parentId: number,
    description?: string | null,
    referenceCode?: string | null,
    previousReferenceCode?: string| null,
    sortOrder?: number,
    isPublished?: boolean,
    validFrom?: string | null, // 'YYYY-MM-DD'
    validTo?: string | null,
    portalUrl?: string | null,
    properties?: Record<string, string| number | boolean | null>,
}
*/

import express, { type Request, type RequestHandler, type Response } from 'express';
import type { Knex } from 'knex';
import { loadStructure } from '../ead/loadStructure';
import { logChange } from '../util/auditLog';
import { fetchNode, isDescendant, upsertProperties } from '../util/nodeHelpers';
import { getNodeTypeIdByCode, parentAllowsChild } from '../repos/archiveRepo';
import type { AuthedRequest } from '../middleware/auth';

interface Deps{
  db: Knex;
  requireRole: (role?: string) =>RequestHandler;
}

interface NodeBody {
  title?: string;
  parentId?: number;
  description?: string | null;
  referenceCode?: string | null;
  previousReferenceCode?: string |null;
  sortOrder?: number;
  isPublished?: boolean;
  validFrom?: string | null;
  validTo?: string| null;
  portalUrl?: string | null;
  properties?: Record<string, string | number | boolean | null> ;
}

// Picks the newest klassificering structure (matches the seed/test's klass-2021). 
// If ever there is two active structures and the URI should carry a version, this would
//become the parameter.
async function getClassificationStructureId(db: Knex): Promise<number | null> {
  const row = await db('structures')
    .where({ structure_type: 'klassificering' })
    .orderBy([
      { column: 'valid_from', order: 'desc' },
      { column: 'id', order: 'desc' },
    ])
    .first<{ id: number }>('id');
  return row?.id ?? null;
}

export function makeProcessesRouter({ db, requireRole }:Deps) {
  const r = express.Router();

  //GET /processes/tree
  // All unpublished branches and non-public properties are cut out.
  r.get('/processes/tree', async (_req: Request, res: Response, next) => {
    try {
      const structureId = await getClassificationStructureId(db);
      if(!structureId) {
        return void res.status(404).json({ error: 'Ingen klassificeringsstruktur finns' });
      }
      const loaded = await loadStructure(db, structureId, { publicOnly: true });
      if (!loaded) {
        return void res.status(404).json({ error: 'Strukturen hittades inte' });
      }
      res.json({
        structure: {
          id: loaded.structure.id,
          code: loaded.structure.code,
          name: loaded.structure.name,
          version: loaded.structure.version,
          validFrom: loaded.structure.valid_from,
          validTo: loaded.structure.valid_to,
        },
        tree: loaded.roots,
      });
    } catch (err) { next(err); }
  });

  //GET /processes/:id
  //It returns one node with metadata, properties, relations.

  r.get('/processes/:id', async (req: Request, res: Response, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return void res.status(400).json({ error: 'Ogiltigt id' });
      }
      const structureId = await getClassificationStructureId(db);
      if (!structureId) {
        return void res.status(404).json({ error: 'Ingen klassificeringsstruktur finns' });
      }
      const node = await fetchNode(db, structureId, id);
      if (!node) {
        return void res.status(404).json({ error: 'Processen finns inte' });
      }
      const relations = await db('node_relations as r')
        .join('relation_types as rt', 'rt.id', 'r.relation_type_id')
        .join('nodes as t', 't.id', 'r.to_node_id')
        .where('r.from_node_id', id)
        .select(
          'r.id', 'rt.code', 'rt.name',
          't.id as targetId', 't.title as targetTitle',
          't.reference_code as targetReferenceCode',
        );
      res.json({ ...node, relations });
    } catch (err) { next(err); }});

  //POST /processes
  // It returns 201 with the created node.
  r.post('/processes', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const body =(req.body ?? {}) as NodeBody;

    //Reject if without a name (whitespace only).
    if (!body.title || typeof body.title !== 'string' ||body.title.trim() === '') {
      return void res.status(400).json({ error: 'title krävs' });
    }
    //Every new node needs a parent.
    if (!Number.isInteger(body.parentId) || (body.parentId as number) <= 0) {
      return void res.status(400).json({ error: 'parentId krävs' });
    }

    try{
      const structureId = await getClassificationStructureId(db);
      if (!structureId) {
        return void res.status(404).json({ error: 'Ingen klassificeringsstruktur finns' });
      }
      const processTypeId = await getNodeTypeIdByCode(db, 'process');
      if(!processTypeId) {
        return void res.status(500).json({ error: 'node_type "process" saknas' });
      }
      const parent = await db('nodes')
        .where({ id: body.parentId as number, structure_id: structureId })
        .first<{ node_type_id: number }>('node_type_id');
      if (!parent){
        return void res.status(400).json({ error: 'Föräldern finns inte i strukturen' });
      }
      //The parent type must allow 'process'.
      if (!(await parentAllowsChild(db, parent.node_type_id, processTypeId))) {
        return void res.status(400).json({
          error: 'node_type_rules tillåter inte process under den föräldern',
        });
      }
      const userId = req.user?.id ?? null;

      //In one action: node insert + properties upserts + change_log.

      const newId = await db.transaction(async (tx) => {
        const inserted = await tx('nodes').insert({
          structure_id: structureId,
          parent_id: body.parentId,
          node_type_id: processTypeId,
          reference_code: body.referenceCode ?? null,
          previous_reference_code: body.previousReferenceCode ?? null,
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

        if (body.properties) {
          await upsertProperties(tx, id, body.properties, userId);
        }
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

  //PUT /processes/:id
  //Partial updates. All omitted fields stay as they are.

  r.put('/processes/:id', requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return void res.status(400).json({ error: 'Ogiltigt id' });
    }
    const body =(req.body ?? {}) as NodeBody;
    if(body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
      return void res.status(400).json({ error:'title får inte vara tomt om det skickas' });
    }

    try{
      const structureId = await getClassificationStructureId(db);
      if (!structureId) {
        return void res.status(404).json({ error: 'Ingen klassificeringsstruktur finns.' });
      }
      const before = await db('nodes').where({ id, structure_id: structureId }).first();
      if (!before) {
        return void res.status(404).json({ error: 'Processen finns inte' });}

      // Validate parentId only if it changes. No cycles.

      if (body.parentId !== undefined) {
        if (!Number.isInteger(body.parentId) || body.parentId <= 0) {
          return void res.status(400).json({ error: 'parentId måste vara ett positivt heltal' });
        }
        if(body.parentId === id) {
          return void res.status(400).json({ error: 'En nod kan inte vara sin egen förälder'});
        }
        if (await isDescendant(db, id, body.parentId)) {
          return void res.status(400).json({ error: 'Flytten skulle skapa en cirkel' });
        }
        const parent = await db('nodes')
          .where({ id: body.parentId, structure_id: structureId })
          .first<{ node_type_id: number }>('node_type_id');
        if(!parent) {
          return void res.status(400).json({error: 'Föräldern finns inte i strukturen' });
        }
        if(!(await parentAllowsChild(db, parent.node_type_id, before.node_type_id))) {
          return void res.status(400).json({ error: 'node_type_rules tillåter inte flytten'});
        }

      }

      const userId= req.user?.id ?? null;
      const patch: Record<string, unknown> = {};
      if(body.title !== undefined) patch.title = body.title;
      if(body.parentId !==undefined) patch.parent_id = body.parentId;
      if(body.description !== undefined) patch.description = body.description;
      if(body.isPublished !== undefined) patch.is_published = Boolean(body.isPublished);
     
      if(body.referenceCode !== undefined) patch.reference_code = body.referenceCode;
      if(body.previousReferenceCode !== undefined) patch.previous_reference_code = body.previousReferenceCode;
      if(body.sortOrder !==undefined) patch.sort_order = body.sortOrder;
      if(body.validFrom !== undefined) patch.valid_from = body.validFrom;
      if(body.validTo !== undefined) patch.valid_to = body.validTo;
      if(body.portalUrl !== undefined) patch.portal_url = body.portalUrl;

      //To use the correct change_log.action
      //this decides which action value to write into change_log: 
      //if the request actually changes is_published from false to true it logs 'publish', 
      //from true to false it logs 'unpublish' and for any other edit it logs 'update'
      const isPublishFlip =
        body.isPublished !== undefined &&
        Boolean(body.isPublished) !== Boolean(before.is_published);
      const action = isPublishFlip
        ? (body.isPublished ? 'publish' : 'unpublish')
        : 'update';

      await db.transaction(async (tx) => {
        if (Object.keys(patch).length) {
          patch.updated_by = userId;
          await tx('nodes').where({ id }).update(patch);
        }
        if (body.properties) {
          await upsertProperties(tx, id, body.properties, userId);
        }
        await logChange(tx, {
          entityType: 'node', entityId: id, structureId,
          action, oldValue: before, newValue: { ...before, ...patch }, userId,
        
        });
      });

      res.json(await fetchNode(db, structureId, id));
    } catch (err) { next(err); }
  });

  // DELETE /processes/:id

  r.delete('/processes/:id',requireRole('editor'), async (req: AuthedRequest, res: Response, next) => {
    const id = Number(req.params.id);
    if(!Number.isInteger(id) || id <= 0) {
      return void res.status(400).json({ error: 'Ogiltigt id' });
    
    }
    try {
      const structureId = await getClassificationStructureId(db);
      if (!structureId) {
        return void res.status(404).json({ error: 'Ingen klassificeringsstruktur finns'});
      }
      const before = await db('nodes').where({ id, structure_id: structureId }).first();
      if (!before) {
        return void res.status(404).json({ error: 'Processen finns inte.' });
      }

      //Never allow deletion of nodes with children!
      const child = await db('nodes').where({ parent_id: id }).first('id');
      if (child){
        return void res.status(409).json({
          error: 'Noden har barn och får inte raderas. Radera barnen först.',
        });
      }

      //Relations too; list them for the frontend.

      const rels = await db('node_relations')
        .where({ from_node_id: id }).orWhere({ to_node_id: id })
        .select('id', 'from_node_id as fromNodeId', 'to_node_id as toNodeId');
      if (rels.length) {
        return void res.status(409).json({
          error: 'Noden har relationer och får inte raderas. Ta bort relationerna först.',
          relations: rels,
        });
      }

      const userId = req.user?.id ?? null;
      await db.transaction(async (tx) => {
        await tx('node_property_values').where({ node_id: id }).del();
        await tx('nodes').where({ id }).del();
        await logChange(tx, {
          entityType: 'node', entityId: id, structureId,
          action: 'delete', oldValue: before, newValue: null, userId,
        });
      });

      res.json(before);
    } catch (err) { next(err); }
  });

  return r;
}