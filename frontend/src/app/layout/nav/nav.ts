import { Component, output, inject } from '@angular/core';
import { LoginService } from '../../core/services/login.service';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  standalone: true,
  selector: 'app-nav',
  styleUrl: './nav.scss',
  templateUrl: './nav.html',
})
export class Nav {
  loginService = inject(LoginService);
  menuIconUrl: string = '/menu.png';
  addIconUrl: string = '/add.png';
  homeIconUrl: string = '/home.png';
  downloadIconUrl: string = '/download.png';
  logoutIconUrl: string = '/logout.png';
  loginIconUrl: string = '/login-icon.png';

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
}
