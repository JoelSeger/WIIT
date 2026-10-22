import { Component } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  logoUrl: string = '/mau-logo.png';
  logoAlt: string = 'Malmö universitets logotyp';

  userLabel: string = 'ANVÄNDARE';
  profileIconUrl: string = '/user-profile.png';

  // Placeholder function until the profile functionality is implemented
  openProfile(): void {
    console.log('Profile button clicked');
  }
}


