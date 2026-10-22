import { Component, output } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-nav',
  styleUrl: './nav.scss',
  templateUrl: './nav.html',
})
export class Nav {
  menuIconUrl: string = '/menu.png';
  addIconUrl: string = '/add.png';
  homeIconUrl: string = '/home.png';
  downloadIconUrl: string = '/download.png';
  logoutIconUrl: string = '/logout.png';

  menuClicked = output<void>();

  openMenu(): void {
    this.menuClicked.emit();
  }

  // Temporary functions for testing button clicks
  addItem(): void {
    console.log('Add button clicked');
  }

  goHome(): void {
    console.log('Home button clicked');
  }

  download(): void {
    console.log('Download button clicked');
  }

  logout(): void {
    console.log('Logout button clicked');
  }
}
