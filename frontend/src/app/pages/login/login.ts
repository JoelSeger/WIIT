import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  // krävs för ngModel som används i html, och för angulars formulärvalidering
  selector: 'app-login',
  imports: [FormsModule],
  styleUrl: './login.scss',
  templateUrl: './login.html',
})

export class LoginComponent {
  // bundna till formuläret via ngModel i html
  email = '';
  password = '';

  isSubmitting = false;
  loginError = '';

  onSubmit(): void {
    // SSO will be implemented here in the future
    // Change to real API-call when SSO is implemented
    console.log("Login submitted.");

    this.loginError = 
      'Inloggning är inte tillgänglig ännu.';
  }
}