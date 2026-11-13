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

  // bundna till formuläret via ngModel i html
  email = '';
  password = '';

  isSubmitting = false;
  loginError = '';

  onSubmit(): void {
    if (!this.email || !this.password) return;
      
      this.isSubmitting = true;
      this.loginError = '';

      if (this.email === 'test@mau.se' && this.password === 'abc123') {
        this.loginService.login(this.email);
        this.router.navigate(['/']);
      } else {
        this.isSubmitting
        this.loginError = 'Felaktig e-postadress eller lösenord.';
      }
  }
}