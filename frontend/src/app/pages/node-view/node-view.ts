import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, linkedSignal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LoginService } from '../../core/services/login.service';
import { StructureService } from '../../core/services/structure.service';
import {
  TreeStateService,
  creatorChain,
  ownerCreator,
  structureContainerKeys,
} from '../../core/services/tree-state.service';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';
import { STRUCTURE_TYPE_LABELS, type StructureSummary } from '../../models/structure.model';
import type { TreeNode } from '../../models/tree-node.model';
import { countNodes, findNodePath, nodeLabel, versionLabel } from '../../shared/tree-utils';
import { formatValidity, groupChildrenByType, toNodeFields } from './node-fields';

export type NodeTab = 'general' | 'details' | 'history';

interface TabDefinition {
  id: NodeTab;
  label: string;
}

/** Tabs from the Figma prototype (figure 4.2). */
const TABS: readonly TabDefinition[] = [
  { id: 'general', label: 'Allmänt' },
  { id: 'details', label: 'Detaljer' },
  { id: 'history', label: 'Historik' },
];

/**
 * Content area for a structure (/structures/:structureId) or one node in it
 * (/structures/:structureId/nodes/:nodeId). Uses the same cached tree as the tree view,
 * so no extra request is made, and opens the path to the node in the tree (F4.2).
 * Shows the node's data (F3.6), validity (F8.1) and its children as cards.
 */
@Component({
  selector: 'app-node-view',
  imports: [RouterLink, DatePipe],
  templateUrl: './node-view.html',
  styleUrl: './node-view.scss',
})
export class NodeView {
  private readonly structureService = inject(StructureService);
  private readonly treeState = inject(TreeStateService);
  private readonly loginService = inject(LoginService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  readonly tabs = TABS;
  readonly nodeLabel = nodeLabel;
  readonly isLoggedIn = computed(() => this.loginService.currentUser() !== null);

  /** Route parameters; NaN when the address is not a number. */
  readonly structureId = computed(() => Number(this.params()?.get('structureId')));
  readonly nodeId = computed(() => {
    const value = this.params()?.get('nodeId');
    return value === null || value === undefined ? null : Number(value);
  });
  readonly isValidAddress = computed(
    () =>
      isPositiveInteger(this.structureId()) &&
      (this.nodeId() === null || isPositiveInteger(this.nodeId())),
  );

  readonly structure = computed<StructureSummary | null>(() => {
    const state = this.structureService.structures();
    return state.status === 'loaded'
      ? (state.data.find((s) => s.id === this.structureId()) ?? null)
      : null;
  });
  readonly structureTypeLabel = computed(() => {
    const type = this.structure()?.structureType;
    return type ? STRUCTURE_TYPE_LABELS[type] : '';
  });

  /** Arkivbildare, or an empty list while they load or if the backend has no endpoint for them. */
  private readonly creators = computed<ArchiveCreatorSummary[]>(() => {
    const state = this.structureService.archiveCreators();
    return state.status === 'loaded' ? state.data : [];
  });

  /** The arkivbildare above the structure, root first, for the breadcrumb. */
  readonly creatorPath = computed(() => {
    const structure = this.structure();
    const owner = structure ? ownerCreator(structure.id, this.creators()) : null;
    return owner ? creatorChain(owner.id, this.creators()) : [];
  });

  /** Folder and arkivbildare rows above the structure in the tree view. */
  private readonly containerKeys = computed(() => {
    const structure = this.structure();
    return structure ? structureContainerKeys(structure, this.creators()) : [];
  });

  readonly structureVersion = computed(() => versionLabel(this.structure()?.version ?? null));

  readonly tree = computed(() => this.structureService.treeState(this.structureId()));
  readonly treeError = computed(() => {
    const tree = this.tree();
    return tree.status === 'error' ? tree.message : null;
  });

  /** The node and its ancestors, root first. */
  readonly path = computed<TreeNode[] | null>(() => {
    const tree = this.tree();
    const nodeId = this.nodeId();
    return tree.status === 'loaded' && nodeId !== null ? findNodePath(tree.data, nodeId) : null;
  });
  readonly node = computed(() => this.path()?.at(-1) ?? null);
  readonly ancestors = computed(() => this.path()?.slice(0, -1) ?? []);

  /** Children of the node, or the top nodes when a whole structure is shown. */
  readonly childGroups = computed(() => {
    const node = this.node();
    if (node) {
      return groupChildrenByType(node.children);
    }
    const tree = this.tree();
    return tree.status === 'loaded' && this.nodeId() === null ? groupChildrenByType(tree.data) : [];
  });

  readonly nodeCount = computed(() => {
    const tree = this.tree();
    return tree.status === 'loaded' ? countNodes(tree.data) : 0;
  });

  readonly fields = computed(() => toNodeFields(this.node()?.values ?? []));
  readonly validity = computed(() => {
    const node = this.node();
    return node ? formatValidity(node.validFrom, node.validTo) : null;
  });

  /** Back to Allmänt every time another node is opened. */
  readonly activeTab = linkedSignal<number | null, NodeTab>({
    source: this.nodeId,
    computation: () => 'general',
  });

  constructor() {
    effect(() => {
      if (this.structureService.structures().status === 'idle') {
        void this.structureService.loadStructures();
      }
      if (this.structureService.archiveCreators().status === 'idle') {
        void this.structureService.loadArchiveCreators();
      }
    });
    effect(() => {
      if (this.isValidAddress() && this.tree().status === 'idle') {
        void this.structureService.loadTree(this.structureId());
      }
    });
    effect(() => {
      const structure = this.structure();
      const node = this.node();
      const isStructurePage = this.nodeId() === null;
      const containerKeys = this.containerKeys();
      untracked(() => this.revealInTree({ structure, node, isStructurePage, containerKeys }));
    });
  }

  selectTab(tab: NodeTab): void {
    this.activeTab.set(tab);
  }

  /** Arrow keys move between the tabs (WAI-ARIA tabs pattern). */
  onTabKeydown(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (next) {
      this.activeTab.set(next.id);
      document.getElementById(`node-tab-${next.id}`)?.focus();
    }
  }

  /** F4.2: open the path to what is shown, also when the page was reached from a search or a link. */
  private revealInTree(shown: {
    structure: StructureSummary | null;
    node: TreeNode | null;
    isStructurePage: boolean;
    containerKeys: string[];
  }): void {
    const { structure, node, containerKeys } = shown;
    if (!structure) {
      return;
    }
    if (node) {
      this.treeState.revealNode({
        containerKeys,
        structureId: structure.id,
        ancestorIds: this.ancestors().map((ancestor) => ancestor.id),
        nodeId: node.id,
      });
    } else if (shown.isStructurePage) {
      this.treeState.revealStructure(containerKeys, structure.id);
    }
  }
}

function isPositiveInteger(value: number | null): boolean {
  return value !== null && Number.isInteger(value) && value > 0;
}
