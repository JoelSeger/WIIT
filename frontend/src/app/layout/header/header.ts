import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginService } from '../../core/services/login.service';

@Component({
  imports: [RouterLink],
  standalone: true,
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})

export class Header {
  loginService = inject(LoginService);

  logoUrl: string = '/MAU-HeaderLogo.png';
  logoAlt: string = 'Logga för Malmö Universitet';
  profileIconUrl: string = '/user-profile.png';
}