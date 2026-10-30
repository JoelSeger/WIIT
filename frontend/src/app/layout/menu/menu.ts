import { Component, HostListener, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  selector: 'app-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu {

  @ViewChild('menuContainer') menuContainer!: ElementRef<HTMLElement>;

  // Tracks whether the menu is open or closed
  isOpen = false;

  menuWidth = 350;

  private isResizing = false;
  private startX = 0;
  private startWidth = 0;

  // Toggles the menu between open and closed
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

    this.menuWidth = Math.max(200, Math.min(600, newWidth));
  }
  
  @HostListener('document:mouseup')
  stopResize(): void {
    this.isResizing = false;
  }
}

