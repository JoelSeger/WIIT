import { Injectable, signal } from '@angular/core';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';
import type { StructureSummary, StructureTypeCode } from '../../models/structure.model';

/** A top folder in the tree view, as in the Figma prototype (Struktur / Förvaring). */
export interface TreeGroup {
  key: TreeGroupKey;
  label: string;
  /** Structure types shown under this folder. */
  structureTypes: readonly StructureTypeCode[];
  /** Page opened when the folder itself is clicked. */
  route: string;
  /** Show the arkivbildare as a level between the folder and its structures. */
  showArchiveCreators: boolean;
}

export type TreeGroupKey = 'struktur' | 'forvaring';

/** Where a node sits, used to open the path to it. */
export interface NodeLocation {
  /** Folder and arkivbildare rows above the structure (see structureContainerKeys). */
  containerKeys: readonly string[];
  structureId: number;
  /** The node's ancestors, root first (not the node itself). */
  ancestorIds: readonly number[];
  nodeId: number;
}

/**
 * Which structure types go under which folder. Kept in one place so it is easy to change
 * if kunden wants arkivförteckningar somewhere else.
 * Struktur: arkivbildare, then their klassificeringsstrukturer and arkivförteckningar
 * (Figma 4.1: Malmö Högskola 1998-2015 / Malmö Universitet).
 * Förvaring: the förvaring trees directly (Figma 5.2: Arkivförteckning 2016-2023, Verksamhetssystem ...).
 */
export const TREE_GROUPS: readonly TreeGroup[] = [
  {
    key: 'struktur',
    label: 'Struktur',
    structureTypes: ['klassificering', 'arkivforteckning'],
    route: '/archive-structure',
    showArchiveCreators: true,
  },
  {
    key: 'forvaring',
    label: 'Förvaring',
    structureTypes: ['forvaring'],
    route: '/storage-unit',
    showArchiveCreators: false,
  },
];

/** Keys that identify a row in the tree view. */
export const treeKeys = {
  group: (key: TreeGroupKey): string => `g:${key}`,
  creator: (creatorId: number): string => `c:${creatorId}`,
  structure: (structureId: number): string => `s:${structureId}`,
  node: (nodeId: number): string => `n:${nodeId}`,
};

/** Returns the folder a structure type belongs to, or null if no folder shows it. */
export function groupForStructureType(structureType: string): TreeGroup | null {
  return TREE_GROUPS.find((group) => group.structureTypes.some((t) => t === structureType)) ?? null;
}

/**
 * The arkivbildare a structure is shown under: the first creator (in the order the backend
 * sends them) whose archives use the structure. null if no creator uses it.
 */
export function ownerCreator(
  structureId: number,
  creators: readonly ArchiveCreatorSummary[],
): ArchiveCreatorSummary | null {
  return creators.find((creator) => creator.structureIds.includes(structureId)) ?? null;
}

/** The creator and its parent creators, root first. Stops at a missing parent or a loop. */
export function creatorChain(
  creatorId: number,
  creators: readonly ArchiveCreatorSummary[],
): ArchiveCreatorSummary[] {
  const byId = new Map(creators.map((creator) => [creator.id, creator]));
  const chain: ArchiveCreatorSummary[] = [];
  let current = byId.get(creatorId);
  while (current && !chain.includes(current)) {
    chain.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return chain;
}

/**
 * Keys of the rows above a structure: its folder and, under Struktur, its arkivbildare.
 * The tree view and the pages use this same rule, so "open the path" always matches the tree.
 */
export function structureContainerKeys(
  structure: StructureSummary,
  creators: readonly ArchiveCreatorSummary[],
): string[] {
  const group = groupForStructureType(structure.structureType);
  if (!group) {
    return [];
  }
  const owner = group.showArchiveCreators ? ownerCreator(structure.id, creators) : null;
  const creatorKeys = owner
    ? creatorChain(owner.id, creators).map((c) => treeKeys.creator(c.id))
    : [];
  return [treeKeys.group(group.key), ...creatorKeys];
}

/**
 * Remembers which rows in the tree view are open and which row is selected.
 * Lives in a service so the state survives when the side menu is closed and opened again,
 * and so the pages and the search can open the path to a node (F4.2).
 */
@Injectable({ providedIn: 'root' })
export class TreeStateService {
  private readonly expandedKeys = signal<ReadonlySet<string>>(new Set());
  private readonly selected = signal<string | null>(null);

  /** Keys of the rows that are open. */
  readonly expanded = this.expandedKeys.asReadonly();
  /** Key of the row that is shown in the content area. */
  readonly selectedKey = this.selected.asReadonly();

  /** Returns true if the row is open. */
  isExpanded(key: string): boolean {
    return this.expandedKeys().has(key);
  }

  /** F4.3.1: opens a closed row and closes an open one. */
  toggle(key: string): void {
    if (this.isExpanded(key)) {
      this.collapse(key);
    } else {
      this.expand(key);
    }
  }

  /** Opens one or more rows. */
  expand(...keys: string[]): void {
    this.expandedKeys.update((current) => {
      const next = new Set(current);
      keys.forEach((key) => next.add(key));
      return next;
    });
  }

  /** Closes a row. Its children keep their state, so they look the same when it is opened again. */
  collapse(key: string): void {
    this.expandedKeys.update((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  /** Marks a row as selected without changing which rows are open. */
  select(key: string | null): void {
    this.selected.set(key);
  }

  /** F4.2: opens every row on the way to a node and selects it. */
  revealNode(location: NodeLocation): void {
    this.expand(
      ...location.containerKeys,
      treeKeys.structure(location.structureId),
      ...location.ancestorIds.map((id) => treeKeys.node(id)),
    );
    this.select(treeKeys.node(location.nodeId));
  }

  /** Opens the rows above a structure and the structure itself, and selects it. */
  revealStructure(containerKeys: readonly string[], structureId: number): void {
    this.expand(...containerKeys, treeKeys.structure(structureId));
    this.select(treeKeys.structure(structureId));
  }

  /** Opens the folder and the parent creators of an arkivbildare and selects it. */
  revealCreator(creatorId: number, creators: readonly ArchiveCreatorSummary[]): void {
    const parents = creatorChain(creatorId, creators).slice(0, -1);
    const groups = TREE_GROUPS.filter((group) => group.showArchiveCreators);
    this.expand(
      ...groups.map((group) => treeKeys.group(group.key)),
      ...parents.map((c) => treeKeys.creator(c.id)),
    );
    this.select(treeKeys.creator(creatorId));
  }
}
