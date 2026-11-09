import { Component, HostListener, ElementRef, ViewChild, inject, signal, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TreeView } from '../tree-view/tree-view'; 

@Component({
  imports: [RouterLink, TreeView],
  selector: 'app-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu implements OnInit {
  @ViewChild('menuContainer') menuContainer!: ElementRef<HTMLElement>;
  private router = inject(Router);
  private http = inject(HttpClient);

  isOpen = false;
  menuWidth = 350;
  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  // State för strukturer
  structures = signal<any[]>([]);
  selectedStructureId = signal<number | null>(null); // Startar som null
  isLoadingStructures = signal<boolean>(true);       // Ny signal för laddningsstatus
  structureError = signal<boolean>(false);           // Hantera fel snyggt

  ngOnInit() {
    // Hämta strukturer från backend
    this.http.get<{ success: boolean; data: any[] }>('/api/structures').subscribe({
      next: (res) => {
        this.structures.set(res.data);
        
        // Hitta Klassificering (Struktur)
        const klassificering = res.data.find(s => s.type === 'klassificering');
        
        if (klassificering) {
          this.selectedStructureId.set(klassificering.id);
        } else if (res.data.length > 0) {
          // Om ingen klassificering finns, ta den första bara för att visa något
          this.selectedStructureId.set(res.data[0].id);
        }
        this.isLoadingStructures.set(false);
      },
      error: (err) => {
        console.error('Fel vid hämtning av strukturer:', err);
        this.structureError.set(true);
        this.isLoadingStructures.set(false);
      }
    });
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

  // Navigering när man klickar på noder i trädet
  onNodeSelected(node: any) {
    if (node.level === 0) {
      // Gör inget särskilt just nu
    } else if (node.level === 1) {
      this.router.navigate(['/archive-structure']);
    } else if (node.level === 2) {
      this.router.navigate(['/storage-unit']);
    }
  }
}