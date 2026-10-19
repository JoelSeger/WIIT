/* 
Small helpers used by routes/processes.ts and routes/archives.ts.
Kept here so the same rule can't drift between the two.
isDescendant: walk parent_id upward to test whether a proposed new 
parent would create a cycle
upsertProperties: replace all node_property_values for a node with
the fields present in `values`. Fields for which key ooesn't match a 
property_definitions row for the node's node_type are skipped.
fetchNode:the "one node" projection used by every
GET-by-id / POST / PUT response.
    */

import type { Knex } from 'knex';

export async function isDescendant(
  db: Knex,
  ancestorId: number,
  maybeDescendantId: number,): Promise<boolean> {
  let current: number | null = maybeDescendantId;
  while (current != null) {
    if (current === ancestorId) return true;
    const row = (await db('nodes')
      .where({ id: current })
      .first('parent_id')) as { parent_id: number | null } | undefined;
current = row?.parent_id ?? null;   
  }
  return false;
}

function valueColumn(dt: string): 'value_text' | 'value_number'| 'value_date' | 'value_boolean' {
  if (dt === 'number') return 'value_number';
  if(dt === 'date') return 'value_date';
  if (dt === 'boolean') return 'value_boolean';
  return 'value_text';
}

export async function upsertProperties(
  tx: Knex.Transaction,
  nodeId: number,
  values: Record<string, string|number | boolean |null>,
  userId: number | null,): Promise<void> {
  for (const [key, raw] of Object.entries(values)) {
    const def = await tx('property_definitions as d')
      .join('nodes as n', 'n.node_type_id', 'd.node_type_id')
      .where({ 'n.id': nodeId, 'd.key': key })
      .first<{ id: number; data_type: string }>('d.id', 'd.data_type');
    if (!def) continue;
 
    /*unique index. If migration 008 adds value_order + is_repeatable,
    this becomes a real upsert on (node_id, property_definition_id,
    value_order).
    */
    await tx('node_property_values')
      .where({ node_id: nodeId, property_definition_id: def.id })
      .del();

    if (raw !== null && raw !== undefined) {
      await tx('node_property_values').insert({
        node_id: nodeId,
        property_definition_id: def.id,
        [valueColumn(def.data_type)]: raw,
        updated_by: userId,
      });
   
    }
  }
}



export async function fetchNode(db: Knex,structureId: number, id: number){
  const node= await db('nodes as n')
    .join('node_types as nt', 'nt.id', 'n.node_type_id')
    .where({ 'n.id': id, 'n.structure_id': structureId })
    .first(
      'n.id', 'n.parent_id as parentId', 'n.title',
      'n.reference_code as referenceCode',
      'n.previous_reference_code as previousReferenceCode',
      'n.description', 'n.sort_order as sortOrder',
      'n.is_published as isPublished',
      'n.valid_from as validFrom', 'n.valid_to as validTo',
      'n.portal_url as portalUrl',
      'n.created_at as createdAt', 'n.updated_at as updatedAt',
      'nt.code as typeCode', 'nt.name as typeName',
    );

  if(!node) return null;
  const props = await db('node_property_values as v')
    .join('property_definitions as d', 'd.id', 'v.property_definition_id')
    .where('v.node_id', id)
    .select(
      'd.key', 'd.label',
      'v.value_text as text', 'v.value_number as number',
      'v.value_date as date', 'v.value_boolean as boolean',
    );
  return{ ...node, properties: props };
}