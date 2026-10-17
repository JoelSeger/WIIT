import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { StructureComponent } from './pages/structure/structure.component';

export const routes: Routes = [
    // endast för att visa login sida, ska vara startsida senare
  { path: '', component: LoginComponent },

  // Struktursidan
  { path: 'structure', component: StructureComponent }
];
