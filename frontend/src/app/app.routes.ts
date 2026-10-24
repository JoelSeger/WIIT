import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { PublicArchivalSystem } from './pages/public-archival-system/public-archival-system';

export const routes: Routes = [
    // endast för att visa login sida, ska vara startsida senare
  { path: '', component: LoginComponent },

  // Struktursidan
  { path: 'public-archival-system', component: PublicArchivalSystem }

  
];
