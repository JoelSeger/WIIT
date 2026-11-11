import type { TreeNode } from '../models/tree-node.model';

/**
 * Returns the node with the given id and all its ancestors, root first,
 * or null when the node is not in the tree (for example unpublished in public mode).
 */
export function findNodePath(nodes: readonly TreeNode[], nodeId: number): TreeNode[] | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return [node];
    }
    const childPath = findNodePath(node.children, nodeId);
    if (childPath) {
      return [node, ...childPath];
    }
  }
  return null;
}

/** Label used in the tree, the heading and the cards, e.g. "1.1 Okategoriserade ärenden". */
export function nodeLabel(node: Pick<TreeNode, 'referenceCode' | 'title'>): string {
  return node.referenceCode ? `${node.referenceCode} - ${node.title}` : node.title;
}

/** Counts all nodes in a tree, children included. */
export function countNodes(nodes: readonly TreeNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

/** "Version 2" stays as it is, a bare "2" becomes "version 2". */
export function versionLabel(version: string | null): string | null {
  if (!version?.trim()) {
    return null;
  }
  return /^\d/.test(version) ? `version ${version}` : version;
}
