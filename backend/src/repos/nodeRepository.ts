import type { Knex } from 'knex';
import type { NodeRow } from '../models/node/nodeRow';

/** Owns the Knex queries and write transactions used by classification and archive endpoints. */
export class NodeRepository{

  /** Share the configured Knex connection; callers use named operations instead of building SQL themselves. */
  constructor(private readonly db: Knex) {}


  /** Load every structure whose configured type is classification. */
  async classificationStructures(): Promise<any[]>{
    return this.db('structures').where({ structure_type: 'klassificering' }).select('*');
  }

  /** Load all nodes for a structure; NodeService turns these flat rows into a tree. */
  async nodesInStructure(structureId: number): Promise<NodeRow[]> {
    return this.db<NodeRow>('nodes').where({ structure_id: structureId }).select('*');
  }


  /** Find one node by its database ID. */
  async node(id: number): Promise<NodeRow | undefined> {
    return this.db<NodeRow>('nodes').where({ id }).first();
  }



  /** Confirm both the structure and node type are active classification records before creation. */

  async activeClassificationTarget(structureId: number, typeId: number): Promise<boolean> {
    const structure = await this.db('structures').where({ id: structureId, structure_type: 'klassificering' }).first();
    const type = await this.db('node_types').where({ id: typeId, structure_type: 'klassificering', is_active: true }).first();
    return Boolean(structure && type);
  }


  /** Return a node only when its type belongs to a classification structure. */

  async classificationNode(id: number): Promise<NodeRow | undefined> {
    const node = await this.node(id);
    if(!node) return undefined;
    const type = await this.db('node_types').where({ id: node.nodeTypeId, structure_type: 'klassificering' }).first();
    return type ? node : undefined;
  }



  /** Find a node only if it is a series-level node in an inventory structure linked to this archive.
   * The EAD-level test is an assumption to confirm for customer-defined types. */

  async series(archiveId: number, seriesId: number): Promise<NodeRow | undefined> {
    return this.db<NodeRow>('nodes as n')
      .join('node_types as nt', 'nt.id', 'n.node_type_id')
      .join('structures as s', 's.id', 'n.structure_id')
      .join('archive_structures as ast', 'ast.structure_id', 's.id')
      .where({ 'n.id': seriesId, 'ast.archive_id': archiveId, 's.structure_type': 'arkivforteckning', 'nt.ead_level': 'series' })
      .select('n.*').first();
  }


  /** Load direct children of a series and include their type labels for the volume list.
   * This might need reviewing!!! Not sure if this is right!!!!!!!!!!!!!*/

  async volumes(seriesId: number): Promise<any[]> {
    return this.db('nodes as n').join('node_types as nt', 'nt.id', 'n.node_type_id')
      .where('n.parent_id', seriesId).orderBy([{ column: 'n.sort_order' }, { column: 'n.id' }])
      .select('n.*', 'nt.code as node_type_code', 'nt.name as node_type_name');
  }


  /** Find a node whose parent is a series in an inventory structure; optionally constrain it to an archive. */

  async volume(volumeId: number, archiveId?: number): Promise<NodeRow | undefined> {
    return this.db<NodeRow>('nodes as v').join('nodes as p', 'p.id', 'v.parent_id')
      .join('node_types as pt', 'pt.id', 'p.node_type_id').join('structures as s', 's.id', 'v.structure_id')
      .modify((query) => {
        query.where({ 'v.id': volumeId, 's.structure_type': 'arkivforteckning', 'pt.ead_level': 'series' });
        if (archiveId !== undefined) query.join('archive_structures as ast', 'ast.structure_id', 's.id').where('ast.archive_id', archiveId);
      }).select('v.*').first();
  }


  /** Load archives, their linked structures, and each structure's node rows for the archive tree response.
   * This currently performs separate reads per archive/structure; consolidate if tree size makes that costly. */

  async archiveTreeData(): Promise<any[]>{
    const archives = await this.db('archives').select('*');
    const output = [];
    for (const archive of archives){
      const linked = await this.db('archive_structures as ast').join('structures as s', 's.id', 'ast.structure_id')
        .where('ast.archive_id', archive.id).select('s.*', 'ast.valid_from as archive_valid_from', 'ast.valid_to as archive_valid_to');
      const structures = [];
      for (const structure of linked) structures.push({ structure, nodes: await this.nodesInStructure(structure.id) });
      output.push({ ...archive, structures });
    }
    return output;
  }


  /** Load an archive and its linked inventory structures, optionally narrowing to a requested structure ID.
   * */

  async archiveStructure(archiveId: number, requestedId?: number): Promise<{ archive?: any; structures: Array<{id:number}> }> {
    const archive = await this.db('archives').where({ id: archiveId }).first();
    let query = this.db('archive_structures as ast').join('structures as s', 's.id', 'ast.structure_id')
      .where({ 'ast.archive_id': archiveId, 's.structure_type': 'arkivforteckning' }).select('s.id');
    if(requestedId !== undefined) query = query.andWhere('s.id', requestedId);

    return { archive, structures: await query };
  }


  /** Find active series types. This currently uses EAD level 'series'; verify that mapping with configured types. */

  async seriesTypes(requestedId?: number): Promise<Array<{id:number}>> {
    let query = this.db('node_types').where({ structure_type: 'arkivforteckning', ead_level: 'series', is_active: true });
    if(requestedId !== undefined) query = query.andWhere({ id: requestedId });

    return query.select('id');
  }


  /** Find active child types allowed beneath the given parent type. */

  async volumeTypes(parentTypeId: number, requestedId?: number): Promise<Array<{id:number}>> {
    let query = this.db('node_type_rules as r').join('node_types as nt', 'nt.id', 'r.child_type_id')
      .where({ 'r.parent_type_id': parentTypeId, 'nt.is_active': true }).select('nt.id');
    if (requestedId !== undefined) query = query.andWhere('nt.id', requestedId);

    return query;
  }


  /** Check whether the configured parent/child type rule exists. */

  async allowedChild(parentTypeId: number, childTypeId: number): Promise<boolean> {
    return Boolean(await this.db('node_type_rules').where({ parent_type_id: parentTypeId, child_type_id: childTypeId }).first());
  }


  /** Return the next sibling position, starting at zero for the first child. */

  async nextSortOrder(structureId: number, parentId: number |null): Promise<number> {
    const row = await this.db('nodes').where({ structure_id: structureId, parent_id: parentId }).max({ value: 'sort_order' }).first();

    return Number(row?.value ?? -1) + 1;
  }

  /** Insert a node and its create audit record atomically so one cannot be saved without the other. */

  async createNode(values: Record<string, unknown>, structureId: number, userId: number | null): Promise<NodeRow> {
    return this.db.transaction(async (trx) =>{
      const [node] = await trx('nodes').insert({ ...values, created_by: userId, updated_by: userId }).returning('*');
      await trx('change_log').insert({ entity_type: 'node', entity_id: node.id, structure_id: structureId, action: 'create', new_value: JSON.stringify(node), changed_by: userId });

      return node as NodeRow;

    });
  }

  /** Update one node and write its before/after audit record in the same transaction. */

  async updateNode(id: number, structureId: number, changes: Record<string, unknown>, userId: number | null, oldNode: NodeRow): Promise<NodeRow | undefined> {
    return this.db.transaction(async (trx) => {
      const update = { ...changes, updated_at: trx.fn.now(), updated_by: userId };
      await trx('nodes').where({ id }).update(update);
      const current = await trx<NodeRow>('nodes').where({ id }).first();
      if(current) await trx('change_log').insert({ entity_type: 'node', entity_id: id, structure_id: structureId,
        action: (changes.isPublished ?? changes.is_published) === undefined || Boolean(changes.isPublished ?? changes.is_published) === Boolean(oldNode.isPublished) ? 'update' : (changes.isPublished ?? changes.is_published) ? 'publish' : 'unpublish',
        old_value: JSON.stringify(oldNode), new_value: JSON.stringify(current), changed_by: userId });

      return current;
    });
  }


  /** Audit the deletion, remove node relations, and delete the node in one transaction.
   * The database's parent foreign key still rejects deletion when children exist. */

  async deleteNode(id: number, node: NodeRow, userId: number | null): Promise<void> {
    await this.db.transaction(async (trx) =>{
      await trx('change_log').insert({ entity_type: 'node', entity_id: id, structure_id: node.structureId, action: 'delete', old_value: JSON.stringify(node), changed_by: userId });
      await trx('node_relations').where((q) => q.where({ from_node_id: id }).orWhere({ to_node_id: id })).del();
      await trx('nodes').where({ id }).del();

    });
  }
}
