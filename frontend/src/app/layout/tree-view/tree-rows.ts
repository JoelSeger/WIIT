import type { LoadState } from '../../core/services/structure.service';
import { type TreeGroup, ownerCreator, treeKeys } from '../../core/services/tree-state.service';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';
import { STRUCTURE_TYPE_LABELS, type StructureSummary } from '../../models/structure.model';
import type { TreeNode } from '../../models/tree-node.model';
import { nodeLabel, versionLabel } from '../../shared/tree-utils';

export type TreeRowKind = 'group' | 'creator' | 'structure' | 'node' | 'message';

/**
 * One visible line in the tree view. The tree is drawn as a flat list with aria-level,
 * which keeps keyboard navigation simple and only renders rows whose parents are open.
 */
export interface TreeRow {
  key: string;
  kind: TreeRowKind;
  label: string;
  /** 1 for the top folders (aria-level). */
  level: number;
  parentKey: string | null;
  /** Position among the siblings (aria-posinset / aria-setsize). */
  posInSet: number;
  setSize: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isPublished: boolean;
  /** Node type, structure type or "Arkivbildare", shown as a tooltip. */
  typeLabel: string;
  link: readonly (string | number)[];
}

export interface TreeRowInput {
  groups: readonly TreeGroup[];
  structures: LoadState<StructureSummary[]>;
  creators: LoadState<ArchiveCreatorSummary[]>;
  treeState: (structureId: number) => LoadState<TreeNode[]>;
  expanded: ReadonlySet<string>;
}

/** Where the children of a row go. */
interface Position {
  parentKey: string;
  level: number;
}

/** One child of a folder or an arkivbildare, before it becomes rows. */
type GroupChild =
  | { kind: 'creator'; creator: ArchiveCreatorSummary }
  | { kind: 'structure'; structure: StructureSummary };

const LOADING_TEXT = 'Laddar …';
const EMPTY_GROUP_TEXT = 'Inga strukturer att visa';
const EMPTY_TREE_TEXT = 'Strukturen har inga noder att visa';
const CREATOR_TYPE_LABEL = 'Arkivbildare';

/** F4.3: builds the rows that are visible with the current open/closed state. */
export function buildTreeRows(input: TreeRowInput): TreeRow[] {
  return input.groups.flatMap((group, index) => {
    const key = treeKeys.group(group.key);
    const isExpanded = input.expanded.has(key);
    const row: TreeRow = {
      key,
      kind: 'group',
      label: group.label,
      level: 1,
      parentKey: null,
      posInSet: index + 1,
      setSize: input.groups.length,
      hasChildren: true,
      isExpanded,
      isPublished: true,
      typeLabel: group.label,
      link: [group.route],
    };
    return isExpanded
      ? [row, ...groupContentRows(group, { parentKey: key, level: 2 }, input)]
      : [row];
  });
}

/**
 * Struktur: top arkivbildare first, then structures that no arkivbildare uses.
 * Förvaring: the structures directly. If the arkivbildare cannot be fetched
 * (for example an older backend without /api/archive-creators) the structures are shown directly.
 */
function groupContentRows(group: TreeGroup, position: Position, input: TreeRowInput): TreeRow[] {
  if (input.structures.status !== 'loaded') {
    return [messageRow(position, stateMessage(input.structures))];
  }
  if (group.showArchiveCreators && isPending(input.creators)) {
    return [messageRow(position, LOADING_TEXT)];
  }
  const structures = input.structures.data.filter((s) =>
    group.structureTypes.some((type) => type === s.structureType),
  );
  const creators =
    group.showArchiveCreators && input.creators.status === 'loaded' ? input.creators.data : [];
  const children = groupChildren(structures, creators, null);
  if (children.length === 0) {
    return [messageRow(position, EMPTY_GROUP_TEXT)];
  }
  return childRows(children, position, { input, structures, creators });
}

interface ChildContext {
  input: TreeRowInput;
  /** Structures of the folder being drawn. */
  structures: readonly StructureSummary[];
  creators: readonly ArchiveCreatorSummary[];
}

/** Creators with this parent (null = top level), then the structures this creator owns. */
function groupChildren(
  structures: readonly StructureSummary[],
  creators: readonly ArchiveCreatorSummary[],
  parent: ArchiveCreatorSummary | null,
): GroupChild[] {
  const knownIds = new Set(creators.map((c) => c.id));
  const subCreators = creators.filter((c) =>
    parent ? c.parentId === parent.id : c.parentId === null || !knownIds.has(c.parentId),
  );
  const ownStructures = structures.filter(
    (s) => (ownerCreator(s.id, creators)?.id ?? null) === (parent?.id ?? null),
  );
  return [
    ...subCreators.map((creator): GroupChild => ({ kind: 'creator', creator })),
    ...ownStructures.map((structure): GroupChild => ({ kind: 'structure', structure })),
  ];
}

function childRows(
  children: readonly GroupChild[],
  position: Position,
  context: ChildContext,
): TreeRow[] {
  return children.flatMap((child, index) => {
    const sibling = { posInSet: index + 1, setSize: children.length };
    return child.kind === 'creator'
      ? creatorRows(child.creator, { ...position, ...sibling }, context)
      : structureRows(child.structure, { ...position, ...sibling }, context.input);
  });
}

type SiblingPosition = Position & { posInSet: number; setSize: number };

function creatorRows(
  creator: ArchiveCreatorSummary,
  position: SiblingPosition,
  context: ChildContext,
): TreeRow[] {
  const key = treeKeys.creator(creator.id);
  const children = groupChildren(context.structures, context.creators, creator);
  const isExpanded = context.input.expanded.has(key) && children.length > 0;
  const row: TreeRow = {
    key,
    kind: 'creator',
    label: creator.name,
    level: position.level,
    parentKey: position.parentKey,
    posInSet: position.posInSet,
    setSize: position.setSize,
    hasChildren: children.length > 0,
    isExpanded,
    isPublished: Boolean(creator.isPublished),
    typeLabel: CREATOR_TYPE_LABEL,
    link: ['/archive-creators', creator.id],
  };
  if (!isExpanded) {
    return [row];
  }
  return [row, ...childRows(children, { parentKey: key, level: position.level + 1 }, context)];
}

function structureRows(
  structure: StructureSummary,
  position: SiblingPosition,
  input: TreeRowInput,
): TreeRow[] {
  const key = treeKeys.structure(structure.id);
  const tree = input.treeState(structure.id);
  const isExpanded = input.expanded.has(key);
  const version = versionLabel(structure.version);
  const row: TreeRow = {
    key,
    kind: 'structure',
    label: version ? `${structure.name} (${version})` : structure.name,
    level: position.level,
    parentKey: position.parentKey,
    posInSet: position.posInSet,
    setSize: position.setSize,
    // Before the tree is loaded we do not know, so it can be opened.
    hasChildren: tree.status !== 'loaded' || tree.data.length > 0,
    isExpanded,
    isPublished: Boolean(structure.isPublished),
    typeLabel: STRUCTURE_TYPE_LABELS[structure.structureType] ?? structure.structureType,
    link: ['/structures', structure.id],
  };
  if (!isExpanded) {
    return [row];
  }
  return [row, ...treeRows(tree, { parentKey: key, level: position.level + 1 }, input.expanded)];
}

function treeRows(
  tree: LoadState<TreeNode[]>,
  position: Position,
  expanded: ReadonlySet<string>,
): TreeRow[] {
  if (tree.status !== 'loaded') {
    return [messageRow(position, stateMessage(tree))];
  }
  if (tree.data.length === 0) {
    return [messageRow(position, EMPTY_TREE_TEXT)];
  }
  return nodeRows(tree.data, position, expanded);
}

function nodeRows(
  nodes: readonly TreeNode[],
  position: Position,
  expanded: ReadonlySet<string>,
): TreeRow[] {
  return nodes.flatMap((node, index) => {
    const key = treeKeys.node(node.id);
    const isExpanded = expanded.has(key) && node.children.length > 0;
    const row: TreeRow = {
      key,
      kind: 'node',
      label: nodeLabel(node),
      level: position.level,
      parentKey: position.parentKey,
      posInSet: index + 1,
      setSize: nodes.length,
      hasChildren: node.children.length > 0,
      isExpanded,
      isPublished: Boolean(node.isPublished),
      typeLabel: node.nodeType.name,
      link: ['/structures', node.structureId, 'nodes', node.id],
    };
    if (!isExpanded) {
      return [row];
    }
    const childPosition = { parentKey: key, level: position.level + 1 };
    return [row, ...nodeRows(node.children, childPosition, expanded)];
  });
}

function messageRow(position: Position, text: string): TreeRow {
  return {
    key: `${position.parentKey}:message`,
    kind: 'message',
    label: text,
    level: position.level,
    parentKey: position.parentKey,
    posInSet: 1,
    setSize: 1,
    hasChildren: false,
    isExpanded: false,
    isPublished: true,
    typeLabel: '',
    link: [],
  };
}

function isPending(state: LoadState<unknown>): boolean {
  return state.status === 'idle' || state.status === 'loading';
}

function stateMessage(state: LoadState<unknown>): string {
  return state.status === 'error' ? state.message : LOADING_TEXT;
}
