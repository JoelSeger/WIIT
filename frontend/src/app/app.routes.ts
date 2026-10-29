import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { PublicArchivalSystem } from './pages/public-archival-system/public-archival-system';
import { ArchiveStructure } from './pages/archive-structure/archive-structure';

export const routes: Routes = [
    // endast för att visa login sida, ska vara startsida senare
  { path: '', component: LoginComponent },

  // Sök sidan
  { path: 'public-archival-system', component: PublicArchivalSystem },

  //Arkivbildare
  { path: 'archive-structure', component: ArchiveStructure }

  
];
