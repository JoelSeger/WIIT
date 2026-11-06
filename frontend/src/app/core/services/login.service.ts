import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoginService {
  currentUser = signal<string | null>(null);

  login(email: string) {
    this.currentUser.set(email);
  }

  logout() {
    this.currentUser.set(null);
  }
}
