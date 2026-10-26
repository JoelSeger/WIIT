import type { Request, Response } from 'express';
import { BaseController } from './baseController';
import type { RequestContext } from '../types/requestContext';
import { findNode, nodeChangeAction, recordNodeChange, toTree, validId, type NodeRow } from './nodeApiSupport';

export class ClassificationController extends BaseController {

  /* This passes the current request's context to BaseController so all classification operations
  share the request user and database connection. */
  constructor(context: RequestContext) { super(context); }


  /* What if there is more than one classification structure?
  the return here is for every classification structure, for now I guess.
  If there is more than one classification structure maybe we have to send in a structure_id parameter?*/

  /* This loads every classification structure and its node rows, then uses toTree to return each structure as a nested JSON.
  It gives the frontend enough information to render the complete classification hierarchy, or should! */

  getTree = async (_req: Request, res: Response): Promise<void> => {
    try {
      const structures = await this.db('structures').where({ structure_type: 'klassificering' }).select('*');
      const result = [];
      for (const structure of structures) {
        const nodes = await this.db<NodeRow>('nodes').where({ structure_id: structure.id }).select('*');
        result.push({ structure, nodes: toTree(nodes) });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Could not load process tree.' });
    }
  };



  /* this validates the requested node ID, loads that node, and checks its node type belongs to a classification structure before returning it.
  Invalid IDs receive 400; missing or wrong-kind nodes receive 404. */

  getOne = async (req: Request, res: Response): Promise<void> => {
    const id = validId(req.params.id);
    if (id === null) { res.status(400).json({ error: 'id must be a positive integer.' }); return; }
    try {
      const node = await findNode(this.db, id);
      if (!node) { res.status(404).json({ error: 'Process not found.' }); return; }
      const type = await this.db('node_types').where({ id: node.node_type_id }).first();
      if (type?.structure_type !== 'klassificering') { res.status(404).json({ error: 'Process not found.' }); return; }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Could not load process.' });
    }
  };



  /* A series is a node with EAD level "series" in an archive-linked arkivforteckning structure.
  If the client data is using other level instead, this has to be replaced with the mapping for that instead!!!!!!
  /* This Finds one series only when the given node belongs to the requested archive through a linked archival structure and has
  the currently expected EAD series type. It returns the node row or a client error/not-found response. */

  getSeries = async (req: Request, res: Response): Promise<void> => {
    const archiveId = validId(req.params.archiveId);
    const seriesId = validId(req.params.seriesId);
    if (archiveId === null || seriesId === null) {
      res.status(400).json({ error: 'Archive and series IDs must be positive integers.' }); return;
    }
    try {
      const node = await this.db<NodeRow>('nodes as n')
        .join('node_types as nt', 'nt.id', 'n.node_type_id')
        .join('structures as s', 's.id', 'n.structure_id')
        .join('archive_structures as ast', 'ast.structure_id', 's.id')
        .where({ 'n.id': seriesId, 'ast.archive_id': archiveId, 's.structure_type': 'arkivforteckning', 'nt.ead_level': 'series' })
        .select('n.*').first();
      if (!node) { res.status(404).json({ error: 'Series not found for this archive.' }); return; }
      res.json(node);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Could not load series.' });
    }
  };



  /* This creates a classification node after checking authentication and confirming admin/edit permissions, checking
  the required fields, structure/type validity, a real parent in that same structure, and the permitted parent-child type rule.
  It inserts the node and its audit entry, and then it returns the created row. */

  create = async(req: Request, res: Response): Promise<void> => {
    if (!this.isAuthenticated()){ this.unauthorized(res); return; }
    if (!this.isUserPrivilegeGroup(['administrator', 'hasPermissions'])) {
      this.forbidden(res, 'Editing nodes requires administrator or hasPermissions.'); return;
    }
    const body = req.body ?? {};
    const { structureId, parentId, nodeTypeId, referenceCode = null, sortOrder = 0 } = body;
    const title = body.title ?? body.name;
    if (body.date !== undefined){ res.status(400).json({ error: 'Use validFrom and/or validTo; nodes have no single date field.' }); return; }
    const structureIdNum = Number(structureId);
    const nodeTypeIdNum = Number(nodeTypeId);
    if (!Number.isSafeInteger(structureIdNum) ||!Number.isSafeInteger(nodeTypeIdNum) || typeof title !== 'string'|| !title.trim()) {
      res.status(400).json({ error: 'Expected structureId, nodeTypeId, and a non-empty title.' }); return;
    }

    /*The node creation has to attach the new node to an existing parent. So a missing parent never creates a root!*/
    const parentIdNum = validId(String(parentId ?? ''));
    if(parentIdNum === null) { res.status(400).json({ error: 'parentId is required and must identify an existing node in this structure.' }); return; }
    try {
      const structure = await this.db('structures').where({ id: structureIdNum, structure_type: 'klassificering' }).first();
      const type = await this.db('node_types').where({ id: nodeTypeIdNum, structure_type: 'klassificering', is_active: true }).first();
      if(!structure || !type) { res.status(400).json({ error: 'Unknown classification structure or active node type.' }); return; }
      const parent = await findNode(this.db, parentIdNum);
      if (!parent || parent.structure_id !== structureIdNum) {
        res.status(400).json({ error: 'Parent must exist in the selected structure.' }); return;
      }
      if (parent){
        const allowed =await this.db('node_type_rules').where({ parent_type_id: parent.node_type_id, child_type_id: nodeTypeIdNum }).first();
        if (!allowed) { res.status(400).json({ error: 'This node type is not allowed under that parent type.' }); return; }
      }


      /* -------------------------------------
      The DB stores these node fields;
      the API payload format from the frontend for properties stored in node_property_values is still undecided!
      this has a separate table and needs an agreed JSON shape before they can be accepted here.
      --------------------------------------*/

      const created = await this.db.transaction(async (trx) => {
        const [node] = await trx('nodes').insert({
          structure_id: structureIdNum, parent_id: parent.id, node_type_id: nodeTypeIdNum,
          title: title.trim(), reference_code: referenceCode, sort_order: sortOrder,
          created_by: this.requestContext.user?.id ?? null, updated_by: this.requestContext.user?.id ?? null,
        }).returning('*');
        await recordNodeChange(trx, {
          id: node.id, structureId: structureIdNum, action: 'create', newValue: node,
          changedBy: this.requestContext.user?.id ?? null,
        });
        return node;
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Could not create process.' });
    }
  };



  /* this deletes one classification node for an authorized user. It records the old row, removes relationships that reference the node,
  and deletes it ; the database prevents deleting a node that still has children
  through a NO ACTION FK that blocks the database change when it would break a reference. */

  remove = async (req: Request, res: Response): Promise<void> => {
    if (!this.isAuthenticated()) { this.unauthorized(res); return; }
    if (!this.isUserPrivilegeGroup(['administrator', 'hasPermissions'])) {
      this.forbidden(res, 'Editing nodes requires administrator or hasPermissions.'); return;
    }
    const id = validId(req.params.id);
    if (id === null) { res.status(400).json({ error: 'id must be a positive integer.' }); return; }
    try {
      const node = await findNode(this.db, id);
      if (!node) { res.status(404).json({ error: 'Process not found.' }); return; }
      const type = await this.db('node_types').where({ id: node.node_type_id }).first();
      if (type?.structure_type !== 'klassificering') { res.status(404).json({ error: 'Process not found.' }); return; }

      await this.db.transaction(async (trx) => {
        await recordNodeChange(trx, {
          id, structureId: node.structure_id, action: 'delete', oldValue: node,
          changedBy: this.requestContext.user?.id ?? null,
        });
        await trx('node_relations').where((q) => q.where({ from_node_id: id }).orWhere({ to_node_id: id })).del();
        await trx('nodes').where({ id }).del();
      });
      res.json(node);
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : 'Could not delete process.' });
    }
  };



  /* This applies only fields supplied for an existing classification node.
  It updates the modification metadata, the before-and-after record values in the log, and returns the updated row;
  Incorrect or empty updates are rejected. */

  update = async (req: Request, res: Response): Promise<void> => {
    if (!this.isAuthenticated()) { this.unauthorized(res); return; }
    if (!this.isUserPrivilegeGroup(['administrator', 'hasPermissions'])) {
      this.forbidden(res, 'Editing nodes requires administrator or hasPermissions.'); return;
    }
    const id = validId(req.params.id);
    if(id === null) { res.status(400).json({ error: 'id must be a positive integer.' }); return; }
    const body = req.body ?? {};
    const allowedFields = ['title', 'reference_code', 'previous_reference_code', 'sort_order', 'is_published', 'valid_from', 'valid_to', 'description', 'portal_url'];
    const changes: Record<string, unknown> = {};
    for (const field of allowedFields) if (body[field] !== undefined) changes[field] = body[field];

   if (body.name !== undefined) changes.title = body.name;
    if (body.referenceCode !== undefined) changes.reference_code = body.referenceCode;
    if (body.validFrom !== undefined) changes.valid_from = body.validFrom;
    if (body.validTo !== undefined) changes.valid_to = body.validTo;
    if (body.sortOrder !== undefined) changes.sort_order = body.sortOrder;
    if(body.isPublished !== undefined) changes.is_published = body.isPublished;
    if (body.portalUrl !== undefined) changes.portal_url = body.portalUrl;
    if (body.date !==undefined) { res.status(400).json({ error: 'Use validFrom and/or validTo; there is no single date field.' }); return; }
    if (!Object.keys(changes).length) { res.status(400).json({ error: 'No supported fields were supplied.' }); return; }

    try{
      const node = await findNode(this.db, id);
      if (!node){ res.status(404).json({ error: 'Process not found.' }); return;}
      const type = await this.db('node_types').where({ id: node.node_type_id }).first();
      if(type?.structure_type !== 'klassificering') { res.status(404).json({ error: 'Process not found.' }); return; }
      const updated = await this.db.transaction(async (trx) => {
        changes.updated_at = trx.fn.now();
        changes.updated_by = this.requestContext.user?.id ?? null;
        await trx('nodes').where({ id }).update(changes);
        const current = await trx<NodeRow>('nodes').where({ id }).first();

        if (current){
          await recordNodeChange(trx, {
            id, structureId: node.structure_id,
            action: nodeChangeAction(node, changes),
            oldValue: node, newValue: current, changedBy: this.requestContext.user?.id ?? null,
          });}
        return current;
      });
      res.json(updated);

    } catch (error){
      res.status(409).json({ error: error instanceof Error ? error.message : 'Could not update process.'});
    }
  };
}
