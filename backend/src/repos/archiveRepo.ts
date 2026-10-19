
/*
DB helpers used by routes/processes.ts and routes/archives.ts.

findArkivforteckningStructures - which arkivförteckning structure(s)
serve a given archive (via archive_structures). Archive may have two structures 
(process-based + A-Ö), so this returns {none|one|many} and the caller decides how to respond.
getNodeTypeIdByCode: look up a node_types.id by its code. Is used by
create endpoints to fix the type per route (process,serie,volym). 
It assumes the client names these types literally in the DB, which if not the case needs change.
parentAllowsChild: consult node_type_rules to enforce parent-child relationships in a tree). 
*/

import type { Knex } from 'knex';

export type ArkivforteckningLookup =
  | { kind: 'none'}| { kind: 'one'; id: number } | { kind: 'many'; ids: number[] };

export async function findArkivforteckningStructures(
  db: Knex,
  archiveId: number,
  preferStructureId?: number,): Promise<ArkivforteckningLookup> {
  const rows = await db('archive_structures as l')
    .join('structures as s', 's.id', 'l.structure_id')
    .where('l.archive_id', archiveId)
    .where('s.structure_type', 'arkivforteckning')
    .orderBy([
      { column: 'l.valid_from', order: 'desc' },
      { column: 's.id', order: 'desc' },
    ])
    .select<{ id: number }[]>('s.id');

  if(rows.length === 0) return { kind: 'none'};
  if(preferStructureId != null && rows.some((r)=> r.id === preferStructureId)) {
    return { kind: 'one', id: preferStructureId };}

  if(rows.length === 1) return {kind: 'one', id: rows[0]!.id };
  return { kind: 'many', ids: rows.map((r) => r.id)};
}

export async function getNodeTypeIdByCode(
  db: Knex,
  code: 'process' | 'serie' | 'volym',): Promise<number| null> {
  const row = await db('node_types')
    .where({ code, is_active: true })
    .first<{ id: number }>('id');
  return row?.id ?? null;

}

export async function parentAllowsChild(
  db: Knex,
  parentTypeId: number,
  childTypeId: number,): Promise<boolean> {
  const row = await db('node_type_rules')
    .where({ parent_type_id: parentTypeId, child_type_id: childTypeId })
    .first<{ parent_type_id: number }>('parent_type_id');
  return Boolean(row);


}