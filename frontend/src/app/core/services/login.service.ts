import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class LoginService {
    currentUser = signal<string | null>('test@mau.se'); // Has to be null when SSO is implemented later on.

    // Current state is visitor, this is meant to be connected to SSO later.
    login (email: string) {
        console.log('SSO-inloggning test med: ', email);
        this.currentUser.set(email);
    }

    logout() {
        console.log('SSO-utloggning visas här.');
        this.currentUser.set(null);
    }
}