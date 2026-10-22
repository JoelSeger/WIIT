import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-menu',
  styleUrl: './menu.scss',
  templateUrl: './menu.html',
})
export class Menu {
  // Tracks whether the menu is open or closed
  isOpen = true;

  // Toggles the menu between open and closed
  toggleMenu() {
    this.isOpen = !this.isOpen;
  }
}
