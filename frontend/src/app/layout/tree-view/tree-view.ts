import { Component, inject, input, signal, computed, output, effect, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

// Same shape as the backend TreeNode (backend/src/models/node/treeNode.ts)
export interface NodeValue {
  id: number;
  nodeId: number;
  propertyDefinitionId: number;
  value: string;
  valueOrder: number;
  definition?: { id: number; name: string; isPublic: boolean; sortOrder: number };
}
export interface NodeType { id: number; name: string; code?: string }
export interface TreeNode {
  id: number;
  parentId: number | null;
  nodeTypeId: number;
  title: string;
  referenceCode: string | null;
  isPublished: boolean | number;
  nodeType: NodeType;
  values: NodeValue[];
  children: TreeNode[];
}
export interface FlatTreeNode extends TreeNode {
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

/** F4.3 Tree-view, F4.3.1 Expand/Collapse */
@Component({
  imports: [],
  selector: 'app-tree-view',
  styleUrl: './tree-view.scss',
  templateUrl: './tree-view.html',
})
export class TreeView implements OnDestroy {
  private http = inject(HttpClient);
  private request?: Subscription;

  structureId = input.required<number>();
  nodeSelected = output<FlatTreeNode>();

  nodes = signal<TreeNode[]>([]);
  expandedIds = signal<Set<number>>(new Set());
  selectedId = signal<number | null>(null);
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);

  flatNodes = computed(() => this.flatten(this.nodes(), this.expandedIds(), 0));

  constructor() {
    // Reload when another structure is chosen
    effect(() => {
      const id = this.structureId();
      if (id) this.fetchTree(id);
    });
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
  }

  private fetchTree(id: number) {
    this.request?.unsubscribe(); // ignore the answer for a structure that is no longer chosen
    this.isLoading.set(true);
    this.hasError.set(false);
    this.selectedId.set(null);

    // The backend returns the tree array directly (no { success, data } wrapper)
    this.request = this.http.get<TreeNode[]>(`/api/node/public/structures/${id}/tree`).subscribe({
      next: (tree) => {
        this.nodes.set(tree);
        this.expandedIds.set(new Set(tree.map((n) => n.id))); // roots open from start
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Kunde inte hämta träd från backend:', err);
        this.nodes.set([]);
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  toggle(id: number, event?: Event) {
    event?.stopPropagation();
    const next = new Set(this.expandedIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedIds.set(next);
  }

  selectNode(node: FlatTreeNode) {
    this.selectedId.set(node.id);
    this.nodeSelected.emit(node);
    if (node.hasChildren) this.toggle(node.id);
  }

  private flatten(nodes: TreeNode[], expanded: Set<number>, level: number): FlatTreeNode[] {
    let result: FlatTreeNode[] = [];
    for (const node of nodes) {
      const hasChildren = !!node.children && node.children.length > 0;
      const isExpanded = expanded.has(node.id);
      result.push({ ...node, level, hasChildren, isExpanded });
      if (hasChildren && isExpanded) {
        result = result.concat(this.flatten(node.children, expanded, level + 1));
      }
    }
    return result;
  }

  /** e.g. "3.2.1 Hantera kursplaner" or "HT1 Begäran om utlämnande av allmän handling" */
  getLabel(node: FlatTreeNode): string {
    const title = node.title || `Namnlös nod (${node.id})`;
    return node.referenceCode ? `${node.referenceCode} ${title}` : title;
  }

  getIcon(node: FlatTreeNode): string {
    if (node.level === 0) return '/archive2.png';
    if (node.level === 1) return '/warehouse.png';
    return '/shelving-unit.png';
  }
}
