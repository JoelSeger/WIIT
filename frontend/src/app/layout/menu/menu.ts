import { Component, HostListener, ElementRef, ViewChild, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TreeView, FlatTreeNode } from '../tree-view/tree-view';

export interface StructureSummary {
  id: number;
  code: string;
  name: string;
  structureType: 'klassificering' | 'arkivforteckning' | 'forvaring';
  isPublished: boolean | number;
  version: string | null;
}

@Component({
  imports: [RouterLink, TreeView],
  selector: 'app-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu implements OnInit {
  @ViewChild('menuContainer') menuContainer!: ElementRef<HTMLElement>;
  private http = inject(HttpClient);

  isOpen = false;
  menuWidth = 350;
  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  structures = signal<StructureSummary[]>([]);
  
  // Ny signal för att hålla koll på vilka huvudmappar som är öppna
  expandedStructures = signal<Set<number>>(new Set());
  
  selectedNode = signal<FlatTreeNode | null>(null);
  isLoadingStructures = signal<boolean>(true);
  structureError = signal<boolean>(false);

  ngOnInit() {
    this.http.get<{ success: boolean; data: StructureSummary[] }>('/api/structures').subscribe({
      next: (res) => {
        const published = (res.data ?? []).filter((s) => !!s.isPublished);
        
        // Sortera: Struktur först, sedan Förvaring
        const sorted = [...published].sort((a, b) => {
          const order = { 'klassificering': 1, 'forvaring': 2, 'arkivforteckning': 3 };
          return (order[a.structureType] || 99) - (order[b.structureType] || 99);
        });

        this.structures.set(sorted);
        
        // Öppna alla huvudmappar från start diskutera med gruppen hur man vill göra!
        //this.expandedStructures.set(new Set(sorted.map(s => s.id)));
        
        this.isLoadingStructures.set(false);
      },
      error: (err) => {
        console.error('Fel vid hämtning av strukturer:', err);
        this.structureError.set(true);
        this.isLoadingStructures.set(false);
      },
    });
  }

  getStructureLabel(type: string): string {
    switch (type) {
      case 'klassificering': return 'Struktur';
      case 'forvaring': return 'Förvaring';
      case 'arkivforteckning': return 'Arkivförteckning';
      default: return type;
    }
  }

  // Funktion för att fälla ut/in huvudmapparna
  toggleStructure(id: number, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedStructures());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expandedStructures.set(next);
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
    this.isResizing = false;
  }

  startResize(event: MouseEvent): void {
    if (!this.isOpen || event.button !== 0) return;
    this.isResizing = true;
    this.startX = event.clientX;
    this.startWidth = this.menuContainer.nativeElement.offsetWidth;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    const deltaX = event.clientX - this.startX;
    const newWidth = this.startWidth + deltaX;
    this.menuWidth = Math.max(200, Math.min(850, newWidth));
  }

  @HostListener('document:mouseup')
  stopResize(): void {
    this.isResizing = false;
  }

  onNodeSelected(node: FlatTreeNode) {
    this.selectedNode.set(node);
  }
}