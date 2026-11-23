import { Component, HostListener, ElementRef, ViewChild, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TreeView, FlatTreeNode } from '../tree-view/tree-view';

/** Same fields as GET /api/structures returns (backend StructureRepository.findSummaries). */
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

  // F4.3 – structures shown in the menu tree
  structures = signal<StructureSummary[]>([]);
  selectedStructureId = signal<number | null>(null);
  selectedNode = signal<FlatTreeNode | null>(null); // for the coming detail view
  isLoadingStructures = signal<boolean>(true);
  structureError = signal<boolean>(false);

  ngOnInit() {
    this.http.get<{ success: boolean; data: StructureSummary[] }>('/api/structures').subscribe({
      next: (res) => {
        // The tree uses the public endpoint, which returns 404 for unpublished structures,
        // so only published structures are offered here.
        const published = (res.data ?? []).filter((s) => !!s.isPublished);
        this.structures.set(published);

        // Show the classification structure (Struktur) first, otherwise the first one.
        const klassificering = published.find((s) => s.structureType === 'klassificering');
        this.selectedStructureId.set(klassificering?.id ?? published[0]?.id ?? null);
        this.isLoadingStructures.set(false);
      },
      error: (err) => {
        console.error('Fel vid hämtning av strukturer:', err);
        this.structureError.set(true);
        this.isLoadingStructures.set(false);
      },
    });
  }

  onStructureChange(event: Event) {
    const id = Number((event.target as HTMLSelectElement).value);
    this.selectedStructureId.set(id);
    this.selectedNode.set(null);
  }

  structureTypeLabel(type: StructureSummary['structureType']): string {
    switch (type) {
      case 'klassificering': return 'Struktur';
      case 'arkivforteckning': return 'Arkivförteckning';
      case 'forvaring': return 'Förvaring';
      default: return type;
    }
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

  // Clicked node is kept here so the detail view can use it later.
  onNodeSelected(node: FlatTreeNode) {
    this.selectedNode.set(node);
  }
}
