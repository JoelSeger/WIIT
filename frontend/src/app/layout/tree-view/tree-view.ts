import { Component, inject, input, signal, computed, output, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface NodeValue {
  id: number;
  nodeId: number;
  propertyDefinitionId: number;
  value: string;
  valueOrder: number;
  definition?: { id: number; name: string; isPublic: boolean; sortOrder: number; };
}
export interface NodeType { id: number; name: string; }
export interface TreeNode {
  id: number; parentId: number | null; nodeTypeId: number; isPublished: boolean | number;
  nodeType: NodeType; values: NodeValue[]; children: TreeNode[];
}
export interface FlatTreeNode extends TreeNode {
  level: number; hasChildren: boolean; isExpanded: boolean;
}

@Component({
  imports: [],
  selector: 'app-tree-view',
  styleUrl: './tree-view.scss',
  templateUrl: './tree-view.html',
})
export class TreeView {
  private http = inject(HttpClient);

  structureId = input.required<number>();
  nodeSelected = output<FlatTreeNode>();

  nodes = signal<TreeNode[]>([]);
  expandedIds = signal<Set<number>>(new Set());
  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false); // Ny signal för att visa fel i trädet

  flatNodes = computed(() => {
    return this.flatten(this.nodes(), this.expandedIds(), 0);
  });

  constructor() {
    effect(() => {
      const id = this.structureId();
      if (id) {
        this.fetchTree(id);
      }
    });
  }

  private fetchTree(id: number) {
    this.isLoading.set(true);
    this.hasError.set(false);
    const url = `/api/node/public/structures/${id}/tree`;

    this.http.get<{ success: boolean; data: TreeNode[] }>(url).subscribe({
      next: (response) => {
        const treeData = response.data || response; 
        this.nodes.set(treeData as TreeNode[]);
        this.isLoading.set(false);
        
        const rootIds = (treeData as TreeNode[]).map(n => n.id);
        this.expandedIds.set(new Set(rootIds));
      },
      error: (err) => {
        console.error('Kunde inte hämta träd från backend:', err);
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  toggle(id: number, event: Event) {
    event.stopPropagation();
    const newSet = new Set(this.expandedIds());
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    this.expandedIds.set(newSet);
  }

  selectNode(node: FlatTreeNode) {
    this.nodeSelected.emit(node);
    if (node.hasChildren) {
      this.toggle(node.id, new Event('click'));
    }
  }

  private flatten(nodes: TreeNode[], expanded: Set<number>, level: number): FlatTreeNode[] {
    let result: FlatTreeNode[] = [];
    for (const node of nodes) {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expanded.has(node.id);
      result.push({ ...node, level, hasChildren, isExpanded });
      if (hasChildren && isExpanded) {
        result = result.concat(this.flatten(node.children, expanded, level + 1));
      }
    }
    return result;
  }

  getLabel(node: FlatTreeNode): string {
    if (node.values && node.values.length > 0) {
      return node.values[0].value;
    }
    return `Namnlös nod (${node.id})`;
  }

  getIcon(node: FlatTreeNode): string {
    const typeName = node.nodeType?.name?.toLowerCase() || '';
    
    if (typeName.includes('folder') || typeName.includes('series')) {
      return '/archive2.png'; 
    }
    if (typeName.includes('document') || typeName.includes('file')) {
      return '/shelving-unit.png';
    }
    
    if (node.level === 0) return '/archive2.png';
    if (node.level === 1) return '/warehouse.png';
    return '/shelving-unit.png';
  }
}