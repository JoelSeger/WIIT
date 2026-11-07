import { TreeNode } from '../models/node/treeNode';

/** Helpers shared by the classification and archive request handlers; no database calls here!! */
export type { NodeRow } from '../models/node/nodeRow';


/** Turn flat node rows into a display tree. Parentless rows become roots; other rows attach to their parent,
 * and each sibling list is sorted by sortOrder then ID. */

 export function toTree(rows: Array<Omit<TreeNode, "children">>): TreeNode[] {
   const indexed = new Map<number, TreeNode>();
   for (const row of rows) indexed.set(row.id, { ...row, children: [] });

   console.log("toTREE KÖRS")
   const roots: TreeNode[] = [];
   for (const node of indexed.values()) {
     // Keep accepting snake_case rows too, so older callers can use this helper during a staged migration (?)
     const parentId = node.parentId ?? (node as any).parent_id;
     if (parentId == null) roots.push(node);
     else indexed.get(parentId)?.children.push(node);
   }

   const order = (a: TreeNode, b: TreeNode) =>
     a.sortOrder - b.sortOrder || a.id - b.id;

   const sort = (nodes: TreeNode[]): void => {
     nodes.sort(order);
     nodes.forEach((node) => sort(node.children));
   };
   sort(roots);

   console.log(roots);
   return roots;
 }


/** Parse one positive integer route parameter. Arrays, zero, negatives, and non-numeric values are rejected. */

export function validId(value: string| string[]): number| null{
  if (Array.isArray(value)){
    if (value.length !== 1) return null;
    value = value[0];}
  const id = Number(value);

  return Number.isSafeInteger(id) && id >0 ? id : null;
}
