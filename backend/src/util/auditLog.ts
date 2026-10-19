import type { Knex } from 'knex';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'move'
  | 'publish'
  | 'unpublish'
  | 'import';
  

export interface AuditEntry {
  entityType: 'node';
  entityId: number;
  structureId: number;
  action: AuditAction;
  oldValue: unknown | null;
  newValue: unknown |null;
  userId: number | null;
  comment?: string | null;
}


export async function logChange(tx: Knex.Transaction, e: AuditEntry): Promise<void>{
  await tx('change_log').insert({
    entity_type: e.entityType,
    entity_id: e.entityId,
    structure_id: e.structureId,
    action: e.action,
    old_value: e.oldValue == null ? null : JSON.stringify(e.oldValue),
    new_value: e.newValue == null ? null : JSON.stringify(e.newValue),
    comment: e.comment ?? null,
    changed_by: e.userId,
  
});
}null;