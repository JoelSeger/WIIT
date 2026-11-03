import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { LoginComponent } from './pages/login/login';
import { Settings } from './pages/settings/settings';
import { PublicArchivalSystem } from './pages/public-archival-system/public-archival-system';
import { ArchiveStructure } from './pages/archive-structure/archive-structure';

export const routes: Routes = [
    // endast för att visa login sida, ska vara startsida senare
    // Login
    { path: 'login', component: LoginComponent },

    {
      path : '', 
      component: MainLayoutComponent, 
      children: [
        { path: '', redirectTo: 'settings', pathMatch: 'full' },
        { path: 'settings', component: Settings },
        { path: 'public-archival-system', component: PublicArchivalSystem },
        { path: 'archive-structure', component: ArchiveStructure }
      ]
    }
];