/*
 This holds helpers that are shared by the classification and archive controllers (building nested trees, validating IDs,
 loading nodes,recording changes). It avoids duplicating the same logic in both controllers.
* */

import type { Knex } from 'knex';

export interface NodeRow {
  id: number;
  structure_id: number;
  parent_id: number | null;
  node_type_id: number;
  reference_code: string | null;
  title: string;
  sort_order: number;
  is_published: boolean;
  [key: string]: unknown;
}


/* This converts the database rows of one structure into nested objects with children arrays.
Rows with no parent become roots; other rows are attached to their parent, and each sibling list
is sorted for the tree display.
Attention here!!!!: this absolutely relies on the idea that no child nodes will be parentless if the rules were followed,
so a parentless node is a root */

export function toTree(rows: NodeRow[]): Array<NodeRow & { children: NodeRow[] }> {
  const indexed = new Map<number, NodeRow & { children: NodeRow[] }>();
  for (const row of rows) indexed.set(row.id, { ...row, children: [] });
  const roots: Array<NodeRow & { children: NodeRow[] }> = [];
  for (const node of indexed.values()) {
    if (node.parent_id == null) roots.push(node);
    else indexed.get(node.parent_id)?.children.push(node);
  }
  const order = (a: NodeRow, b: NodeRow) => a.sort_order - b.sort_order || a.id - b.id;
  const sort = (nodes: Array<NodeRow & { children: NodeRow[] }>): void => {
    nodes.sort(order);
    nodes.forEach((node) => sort(node.children as Array<NodeRow & { children: NodeRow[] }>));
  };
  sort(roots);
  return roots;
}



/* This parses a route parameter as a positive integer. Invalids, repeated,zeros, negatives, or not numericals
return null so controllers can reject them before doing the query. */

export function validId(value: string | string[]): number| null {
  if (Array.isArray(value)){
    if (value.length !== 1) return null;
    value = value[0];}
  const id = Number(value);
  return Number.isSafeInteger(id) && id >0 ? id : null;
}


/* This retrieves one node row by the database ID. The controllers use this helper to
validate that a parent or target node exists. */

export async function findNode(db: Knex, id: number): Promise<NodeRow | undefined> {
  return db<NodeRow>('nodes').where({ id }).first();
}


/* this adds a node-change record inside the database transaction. The snapshots of old and new are stored as a JSON so
administrators can later see what changed and which user did it. */

export async function recordNodeChange(
  trx: Knex.Transaction,
  change: {
    id: number;
    structureId: number;
    action: 'create' | 'update' |'delete' | 'publish' | 'unpublish';
    oldValue?: unknown;
    newValue?: unknown;
    changedBy: number | null;
  },): Promise<void> {
  await trx('change_log').insert({
    entity_type: 'node', entity_id: change.id, structure_id: change.structureId,
    action: change.action,
    old_value: change.oldValue === undefined ? null : JSON.stringify(change.oldValue),
    new_value: change.newValue === undefined ? null : JSON.stringify(change.newValue),
    changed_by: change.changedBy,
  });
}


/* this chooses the audit action label for an update: common edits are marked as update,
but changes to the publication state are marked as publish or unpublish. */

export function nodeChangeAction(oldValue: NodeRow, changes: Record<string, unknown>): 'update' | 'publish' | 'unpublish' {
  if (changes.is_published === undefined || Boolean(changes.is_published) === Boolean(oldValue.isPublished ?? oldValue.is_published)) {
    return 'update';
  }
  return changes.is_published ? 'publish' : 'unpublish';
}
