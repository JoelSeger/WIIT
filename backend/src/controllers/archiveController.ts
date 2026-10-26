import type { Request, Response } from 'express';
import { BaseController } from './baseController';
import type { RequestContext } from '../types/requestContext';
import { findNode, nodeChangeAction, recordNodeChange, toTree, validId, type NodeRow } from './nodeApiSupport';

const EDIT_GROUPS = ['administrator', 'hasPermissions'];

export class ArchiveController extends BaseController {

  /* this passes the current request context to shared controller helpers so archive operations can access the session user and database. */
  constructor(context: RequestContext) { super(context); }


  /* This loads each archive and its linked structures, then loads and nests each structure's nodes for tree display.
  The response includes archive-to-structure validity dates; publication filtering is still a required decision. */

  getTree = async (_req: Request, res: Response): Promise<void> => {
    try {
      const archives = await this.db('archives').select('*');
      const output = [];
      for (const archive of archives) {
        const linkedStructures = await this.db('archive_structures as ast')
          .join('structures as s', 's.id', 'ast.structure_id')
          .where('ast.archive_id', archive.id)
          .select('s.*', 'ast.valid_from as archive_valid_from', 'ast.valid_to as archive_valid_to');
        const structures = [];
        for (const structure of linkedStructures) {
          const nodes = await this.db<NodeRow>('nodes').where({ structure_id: structure.id }).select('*');
          structures.push({ structure, nodes: toTree(nodes) });
        }
        output.push({ ...archive, structures });
      }
      // TODO!!!: We have to apply the public visibility rules for archives, structures, nodes.
      res.json(output);
    } catch (error) {
      this.error(res, error instanceof Error ? error.message : 'Could not load archive tree.');
    }
  };

  /* This creates a series node under an existing parent in an archive-linked inventory structure.
  It checks editor/admin permissions, the archive/structure/type selection, the parent-child type rules and
  a not empty name. Then it inserts the node and the audit log entry all at once. */

  createSeries = async (req: Request, res: Response): Promise<void> => {
    if (!this.requireEditor(res)) return;
    const archiveId = validId(req.params.archiveId);
    if (archiveId === null) { this.error(res, 'archiveId must be a positive integer.', 400); return; }
    const { archive, structure, error } = await this.archiveStructure(archiveId, req.body?.structureId);
    if (error) { this.error(res, error.message, error.status); return; }
    if (!archive || !structure){ this.error(res, 'Archive or archival inventory structure not found.', 404); return;}

    const typeId = await this.resolveSeriesType(req.body?.nodeTypeId);

    if(!typeId) {
      this.error(res, 'Could not determine the node type. Supply nodeTypeId if more than one matching type exists.', 400);
      return;
    }
    const parent = await this.requiredParent(req.body?.parentId, structure.id, res);
    if (parent === false) return;
    if (!(await this.isAllowedChild(parent.node_type_id, typeId))){
      this.error(res, 'This node type is not allowed under the selected parent.', 400); return;
    }
    const fields = nodeFields(req.body);
    if (fields.error){ this.error(res, fields.error, 400); return; }
    if (typeof fields.values.title !== 'string' || !fields.values.title.trim()) {
      this.error(res, 'name/title is required to create a series.', 400); return;
    }
    try{
      const sortOrder = fields.values.sort_order ?? await this.nextSortOrder(structure.id, parent.id);
      const created = await this.db.transaction(async (trx) => {
        const [node] = await trx('nodes').insert({
          structure_id: structure.id, parent_id: parent.id, node_type_id: typeId, ...fields.values, sort_order: sortOrder,
          created_by: this.requestContext.user?.id ?? null, updated_by: this.requestContext.user?.id ?? null,
        }).returning('*');
        await recordNodeChange(trx, {
          id: node.id, structureId: structure.id, action: 'create', newValue: node,
          changedBy: this.requestContext.user?.id ?? null,});

        return node;
      });
      res.status(201).json(created);

    } catch (error) {
      this.error(res, error instanceof Error ? error.message : 'Could not create series.', 409);
    }
  };


  /* This Confirms the series belongs to the URL's archive and delegates its single-node deletion to
  a shared transaction helper. checks for authorization (that we still need to implement) before any lookup or change. */

  deleteSeries = async (req: Request, res: Response): Promise<void> => {
    if(!this.requireEditor(res)) return;
    const archiveId = validId(req.params.archiveId);
    const seriesId = validId(req.params.seriesId);
    if (archiveId === null || seriesId === null) { this.error(res, 'Archive and series IDs must be positive integers.', 400); return; }
    const series = await this.findSeries(archiveId, seriesId);
    if (!series) { this.error(res, 'Series not found for this archive.', 404); return;}
    await this.deleteNodeAndRelations(seriesId, res);
  };


  /* This Verifies the series/archive relationship, maps any supported body fields to the database columns,
  row and audit log are updated; it finally returns the updated node. */

  updateSeries = async (req: Request, res: Response): Promise<void> => {
    if (!this.requireEditor(res)) return;
    const archiveId = validId(req.params.archiveId);
    const seriesId = validId(req.params.seriesId);
    if (archiveId === null || seriesId === null) { this.error(res, 'Archive and series IDs must be positive integers.', 400); return; }
    const series = await this.findSeries(archiveId, seriesId);
    if (!series) { this.error(res, 'Series not found for this archive.', 404); return; }
    const fields = nodeFields(req.body);
    if (fields.error) { this.error(res, fields.error, 400); return; }
    if (!Object.keys(fields.values).length) { this.error(res, 'No supported node fields were supplied.', 400); return; }
    try {
      const updated = await this.db.transaction(async (trx) => {
        await trx('nodes').where({ id: seriesId }).update({
          ...fields.values, updated_at: trx.fn.now(), updated_by: this.requestContext.user?.id ?? null,
        });
        const current = await trx<NodeRow>('nodes').where({ id: seriesId }).first();
        if (current) {
          await recordNodeChange(trx, {
            id: seriesId, structureId: series.structure_id, action: nodeChangeAction(series, fields.values), oldValue: series, newValue: current,
            changedBy: this.requestContext.user?.id ?? null,
          });
        }
        return current;
      });
      res.json(updated);
    } catch (error) {
      this.error(res, error instanceof Error ? error.message : 'Could not update series.', 409);
    }
  };

  /* This finds all the direct child nodes of a series and returns them in correct display order with the node-type names.
  At present, this treats every direct child as a volume because there is no volume-type filter of any kind.
  Basically the code returns every node whose parent_id is that series,but it does not check whether each child’s type is actually “volume.”
  This comes from uncertainty in the project’s node-type mapping: until we define which type or types count as volumes,
  the route will return other kinds of children too. I might be totally confused here!!!*/

  getVolumes = async (req: Request, res: Response): Promise<void> => {
    const archiveId = validId(req.params.archiveId);
    const seriesId = validId(req.params.seriesId);
    if (archiveId === null || seriesId === null) { this.error(res, 'Archive and series IDs must be positive integers.', 400); return; }
    const series = await this.findSeries(archiveId, seriesId);
    if (!series) { this.error(res, 'Series not found for this archive.', 404); return; }
    try {

    /*Here a series' volumes are direct child nodes.
     Their actual type names come from node_types; a series can contain non-volume children, might need to add a volume-type
     rule here instead of treating every child as a volume.*/

      const volumes = await this.db('nodes as n')
        .join('node_types as nt', 'nt.id', 'n.node_type_id')
        .where('n.parent_id', seriesId)
        .orderBy([{ column: 'n.sort_order' }, { column: 'n.id' }])
        .select('n.*', 'nt.code as node_type_code', 'nt.name as node_type_name');
      res.json(volumes);
    } catch (error) {
      this.error(res, error instanceof Error ? error.message : 'Could not load volumes.');
    }
  };


  /* This creates a volume as a direct child of the specified series. It requires editor/admin access and a name,
  determines the allowed child type from the node-type rules, then saves the node and the audit log entry in one go. */

  createVolume = async (req: Request, res: Response): Promise<void> => {
    if (!this.requireEditor(res)) return;
    const archiveId = validId(req.params.archiveId);
    const seriesId = validId(req.params.seriesId);
    if(archiveId === null || seriesId === null){ this.error(res, 'Archive and series IDs must be positive integers.', 400); return; }
    const series = await this.findSeries(archiveId, seriesId);
    if (!series) { this.error(res, 'Series not found for this archive.', 404); return; }
    const typeId = await this.resolveVolumeType(series.node_type_id, req.body?.nodeTypeId);

    if (!typeId){
      this.error(res, 'Could not determine the volume node type. Supply nodeTypeId if the series allows multiple child types.', 400);
      return;
    }
    const fields = nodeFields(req.body);
    if (fields.error) { this.error(res, fields.error, 400); return; }
    if (typeof fields.values.title !== 'string' || !fields.values.title.trim()) {
      this.error(res, 'A non-empty name/title is required to create a volume.', 400); return;
    }
    try {
      const sortOrder = fields.values.sort_order ?? await this.nextSortOrder(series.structure_id, seriesId);
      const created = await this.db.transaction(async (trx) => {
        const [node] = await trx('nodes').insert({
          structure_id: series.structure_id, parent_id: seriesId, node_type_id: typeId, ...fields.values, sort_order: sortOrder,
          created_by: this.requestContext.user?.id ?? null, updated_by: this.requestContext.user?.id ?? null,
        }).returning('*');
        await recordNodeChange(trx, {
          id: node.id, structureId: series.structure_id, action: 'create', newValue: node,
          changedBy: this.requestContext.user?.id ?? null, });
        return node;
      });
      res.status(201).json(created);

    } catch (error) {
      this.error(res, error instanceof Error ? error.message : 'Could not create volume.', 409);
    }
  };


  /* This verifies that the volume ID is a child of a series in the archive that is named in the request body,
  then it updates the node fields and records the change in one transaction. */

  updateVolume = async (req: Request, res: Response): Promise<void> => {
    if (!this.requireEditor(res)) return;
    const volumeId = validId(req.params.volumeId);
    if (volumeId === null) { this.error(res, 'volumeId must be a positive integer.', 400); return; }
    const archiveId = req.body?.archiveId == null ? null : validId(String(req.body.archiveId));
    if (archiveId === null) { this.error(res, 'archiveId must be supplied as a positive integer.', 400); return; }
    const volume = await this.findVolume(volumeId, archiveId);
    if (!volume) { this.error(res, 'Volume not found.', 404); return; }
    const fields = nodeFields(req.body);
    if (fields.error) { this.error(res, fields.error, 400); return; }
    if (!Object.keys(fields.values).length) { this.error(res, 'No supported node fields were supplied.', 400); return; }
    try {
      const updated = await this.db.transaction(async (trx) => {
        await trx('nodes').where({ id: volumeId }).update({
          ...fields.values, updated_at: trx.fn.now(), updated_by: this.requestContext.user?.id ?? null,
        });
        const current = await trx<NodeRow>('nodes').where({ id: volumeId }).first();
        if (current) {
          await recordNodeChange(trx, {
            id: volumeId, structureId: volume.structure_id, action: nodeChangeAction(volume, fields.values), oldValue: volume, newValue: current,
            changedBy: this.requestContext.user?.id ?? null,
          });
        }
        return current;
      });
      res.json(updated);
    } catch (error) {
      this.error(res, error instanceof Error ? error.message : 'Could not update volume.', 409);
    }
  };


  /* This confirms that the target is a volume under a series,and it then removes that node through the shared delete helper that is audit-logged
  The child rows, if present, prevent the deletion through the database constraint. (The NO ACTION foreign key on nodes.parent_id)*/

  deleteVolume = async (req: Request, res: Response): Promise<void> => {
    if (!this.requireEditor(res)) return;
    const volumeId = validId(req.params.volumeId);
    if (volumeId === null) { this.error(res, 'volumeId must be a positive integer.', 400); return; }
    const volume = await this.findVolume(volumeId);
    if (!volume) { this.error(res, 'Volume not found.', 404); return; }
    await this.deleteNodeAndRelations(volumeId, res);
  };

  /* This returns true only when the request has a session user with editing permissions.
  It sends 401 or 403 when access fails. */

  private requireEditor(res: Response): boolean {
    if (!this.isAuthenticated()) { this.unauthorized(res); return false; }
    if (!this.isUserPrivilegeGroup(EDIT_GROUPS)) {
      this.forbidden(res, 'Editing nodes requires administrator or hasPermissions.'); return false;
    }
    return true;
  }

  /* Join for the node to its type, structure and archive link to ensure the requested node is the expected kind of series
  belonging to that archive. */

  private async findSeries(archiveId: number, seriesId: number): Promise<NodeRow | undefined> {

 /*
The code identifies a series by checking that its node type has EAD level series. If the series is represented
using EAD’s otherlevel, this lookup won’t find it; I mean that the rule that tells the code which database node type represents a series
(EAD level is 'series' vs. identified by some "otherlevel" value). The requirements describe series conceptually but not which database value
identifies it. Otherwise, the query would need to check the node-type instead (?)

*/
    return this.db<NodeRow>('nodes as n')
      .join('node_types as nt', 'nt.id', 'n.node_type_id')
      .join('structures as s', 's.id', 'n.structure_id')
      .join('archive_structures as ast', 'ast.structure_id', 's.id')
      .where({ 'n.id': seriesId, 'ast.archive_id': archiveId, 's.structure_type': 'arkivforteckning', 'nt.ead_level': 'series' })
      .select('n.*').first();
  }


  /* this identifies a volume by checking that its parent is a series in an archival inventory structure;
  when an archive ID is supplied, it also verifies the archive link. */

  private async findVolume(volumeId: number, archiveId?: number): Promise<NodeRow | undefined> {
    return this.db<NodeRow>('nodes as v')
      .join('nodes as p', 'p.id', 'v.parent_id')
      .join('node_types as pt', 'pt.id', 'p.node_type_id')
      .join('structures as s', 's.id', 'v.structure_id')
      .modify((query) => {
        query.where({ 'v.id': volumeId, 's.structure_type': 'arkivforteckning', 'pt.ead_level': 'series' });
        if (archiveId !== undefined) query.join('archive_structures as ast', 'ast.structure_id', 's.id').where('ast.archive_id', archiveId);
      })
      .select('v.*').first();
  }

  /* This finds the archive and the linked archival inventory structure. If there are multiple linked structures,
  it requires a caller-supplied structure ID instead of guessing which tree to modify. */

  private async archiveStructure(archiveId: number, requestedId: unknown): Promise<{
    archive?: Record<string, unknown>; structure?: { id: number }; error?:{ message: string; status: number };
  }> {
    const archive = await this.db('archives').where({ id: archiveId }).first();
    if (!archive) return { error: { message: 'Archive not found.', status: 404 } };
    const query = this.db('archive_structures as ast')
      .join('structures as s', 's.id', 'ast.structure_id')
      .where({ 'ast.archive_id': archiveId, 's.structure_type': 'arkivforteckning' })
      .select('s.id');

    if (requestedId !== undefined && requestedId !== null){
      const id = validId(String(requestedId));
      if (!id) return { error: { message: 'structureId must be a positive integer.', status: 400 } };
      query.andWhere('s.id', id);
    }
    const structures = await query;
    if (!structures.length) return { error: { message: 'Archive has no linked archival inventory structure.', status: 409 } };
    if (structures.length > 1) return { error: { message: 'More than one archival inventory structure is linked; supply structureId.', status: 409 } };
    return { archive, structure: structures[0] as { id: number } };
  }


  /* This determines the active node type used for series in this structure. A type ID narrows the lookup;
   if null, it means there was no matching type. */

  private async resolveSeriesType(requested: unknown): Promise<number | null> {
    const query = this.db('node_types').where({ structure_type: 'arkivforteckning', ead_level: 'series', is_active: true });
    if (requested !== undefined && requested !== null) {
      const id = validId(String(requested));
      if (!id) return null;
      query.andWhere({ id });
    }
    const types = await query.select('id');
    return types.length === 1 ? Number(types[0].id) : null;
  }


  /* This Looks up the active child node types allowed beneath a series type.
  It returns an ID only when one type is selected unambiguously, either naturally or by the caller's requested ID.
  If there’s exactly one allowed type, it uses that; if there are several, the request must specify
  nodeTypeId so the backend knows which one to create.
  This was AI's insistence!!! still wrapping my head around it!*/

  private async resolveVolumeType(parentTypeId: number, requested: unknown): Promise<number | null> {
    const query = this.db('node_type_rules as r')
      .join('node_types as nt', 'nt.id', 'r.child_type_id')
      .where({ 'r.parent_type_id': parentTypeId, 'nt.is_active': true })
      .select('nt.id');
    if (requested !== undefined && requested !== null) {
      const id = validId(String(requested));
      if (!id) return null;
      query.andWhere('nt.id', id);
    }
    const types = await query;
    return types.length === 1 ? Number(types[0].id) : null;
  }



  /* This requires a positive parent ID, loads the node and confirms it belongs to the chosen structure.
  It sends a 400 response and returns false for missing or invalid parents, which prevents accidental root creations. */

  private async requiredParent(value: unknown, structureId: number, res: Response): Promise<NodeRow | false> {
    if(value === undefined || value === null) {
      this.error(res, 'parentId is required; nodes cannot be created as roots.', 400);
      return false;
    }
    const id = validId(String(value));
    if(!id){ this.error(res, 'parentId must be a positive integer.', 400); return false; }
    const parent = await findNode(this.db, id);
    if (!parent || parent.structure_id !== structureId){
      this.error(res, 'Parent must exist in the selected structure.', 400);
      return false;
    }

    return parent;
  }


  /* This checks the configured parent-to-child node-type rule that determines whether this kind of node can be placed under
  that kind of parent. */

  private async isAllowedChild(parentTypeId: number, childTypeId: number): Promise<boolean> {
    return Boolean(await this.db('node_type_rules').where({ parent_type_id: parentTypeId,
      child_type_id: childTypeId }).first());
  }


  /* this finds the largest sibling sorting order for this parent and returns the next integer,
  so a newly created child appears after existing siblings by default. */

  private async nextSortOrder(structureId: number, parentId: number | null): Promise<number> {
    const row = await this.db('nodes').where({ structure_id: structureId,
      parent_id: parentId }).max({ value: 'sort_order' }).first();
    return Number(row?.value ?? -1) + 1;
  }


  /* This writes a deletion in the audit log, removes the relationships that point to the node, and deletes the node.
  The database rejects the delete if the node still has children; if success, it returns the removed row. */

  private async deleteNodeAndRelations(id: number, res: Response): Promise<void> {
    try {
      const node = await findNode(this.db, id);
      await this.db.transaction(async (trx) => {
        if (node) {
          await recordNodeChange(trx, {
            id, structureId: node.structure_id, action: 'delete', oldValue: node,
            changedBy: this.requestContext.user?.id ?? null,
          });}
        await trx('node_relations').where((q) => q.where({ from_node_id: id }).orWhere({ to_node_id: id })).del();
        await trx('nodes').where({ id }).del();
      });
      res.json(node);

    } catch (error){
      this.error(res, error instanceof Error ? error.message : 'Could not delete node; Node may have children.', 409);
    }
  }
}



/* This converts API request fields to their database column names and validates values before insert/update logic uses them.
It returns mapped values plus an error string when a name is empty or a generic date field is supplied.
Attention here!!!: This mapping might not be needed at all or just be left here as a safeguard. The thing is we have not yet agreed
exactly what will be sent from the frontend!
*/

function nodeFields(body: Record<string, unknown> | undefined): { values: Record<string, unknown>; error?: string } {

  /*The API payload currently maps the columns on nodes.
  Custom archive fields live in node_property_values and need a separate agreed JSON representation before saving here.
  */
  const input = body ?? {};
  const values: Record<string, unknown> = {};
  const fields: Record<string, string> = {
    title: 'title', name: 'title', referenceCode: 'reference_code', previousReferenceCode: 'previous_reference_code',
    sortOrder: 'sort_order', validFrom: 'valid_from', validTo: 'valid_to', description: 'description',
    portalUrl: 'portal_url', isPublished: 'is_published',
  };
  for (const [source, target] of Object.entries(fields)) {
    if (input[source] !== undefined) values[target] = input[source];
  }
  if ('title' in values && (typeof values.title !== 'string' || !values.title.trim())) {
    return { values, error: 'name/title must not be empty strings.' };
  }
  /*The schema has valid_from and valid_to, but no single generic "date" field. AI suggestion*/
  if (input.date !== undefined) return { values, error: 'Use validFrom and/or validTo; the schema has no single date field.' };
  return { values };
}
