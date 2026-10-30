import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginService } from '../../core/services/login.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  loginService = inject(LoginService)

  logoUrl: string = '/MAU-HeaderLogo.png';
  logoAlt: string = 'Malmö universitets logotyp';
  profileIconUrl: string = '/user-profile.png';
  loginIconUrl: string ='/login-icon.png';
}