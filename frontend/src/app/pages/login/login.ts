import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoginService } from '../../core/services/login.service';

@Component({
  // krävs för ngModel som används i html, och för angulars formulärvalidering
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './login.scss',
  templateUrl: './login.html',
})

export class LoginComponent {
  loginService = inject(LoginService);
  router = inject(Router);

  // bundna till formuläret via ngModel, @if och state i html
  email = '';
  password = '';
  loginError = '';
  isSubmitting = false;

  onSubmit() {
    if (!this.email || !this.password) return;

    this.isSubmitting = true;
    this.loginError = '';

    // SSO will be implemented here in the future
    // Change to real API-call when SSO is implemented
    // As of now it's just a cheatcode
    if (this.email == 'test@mau.se' && this.password == 'abc123') {
      this.loginService.login(this.email);
      this.router.navigate(['/']);
    } else {
      this.isSubmitting = false;
      this.loginError = 'Fel e-post eller lösenord. (Testa: test@mau.se & abc123)';
    }
  }
}
