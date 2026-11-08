import { Component, inject, input, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface NodeValue {
  id: number;
  nodeId: number;
  propertyDefinitionId: number;
  value: string;
  valueOrder: number;
  definition?: {
    id: number;
    name: string;
    isPublic: boolean;
    sortOrder: number;
  };
}

export interface NodeType {
  id: number;
  name: string; 
}

export interface TreeNode {
  id: number;
  parentId: number | null;
  nodeTypeId: number;
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

@Component({
  imports: [],
  selector: 'app-tree-view',
  styleUrl: './tree-view.scss',
  templateUrl: './tree-view.html',
})
export class TreeView implements OnInit {
  private http = inject(HttpClient);

  structureId = input.required<number>();

  // signals för att hålla koll på datan
  nodes = signal<TreeNode[]>([]); // hela trädet från backend
  expandedIds = signal<Set<number>>(new Set()); // vilka noder som är öppna
  isLoading = signal<boolean>(true);          

  flatNodes = computed(() => {
    return this.flatten(this.nodes(), this.expandedIds(), 0);
  });

  ngOnInit() {
    this.fetchTree();
  }

  private fetchTree() {
    const url = `/api/node/public/structures/${this.structureId()}/tree`;

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
        this.isLoading.set(false);
      }
    });
  }

  
  toggle(id: number, event: Event) {
    event.stopPropagation(); 
    
    const newSet = new Set(this.expandedIds());
    if (newSet.has(id)) {
      newSet.delete(id); 
    } else {
      newSet.add(id);    
    }
    this.expandedIds.set(newSet); 
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
}