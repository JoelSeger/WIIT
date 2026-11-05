import { Routes } from '@angular/router;';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { LoginComponent } from './pages/login/login';
import { Settings } from './pages/settings/settings';
import { PublicArchivalSystem } from './pages/public-archival-system/public-archival-system';
import { ArchiveStructure } from './pages/archive-structure/archive-structure';
import { StorageUnit } from './pages/storage-unit/storage-unit';
import { ExportArchive } from './pages/export-archive/export-archive';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },

    {
      path : '', 
      component: MainLayoutComponent, 
      children: [
        // Startsidan
        { path: '', redirectTo: 'public-archival-system', pathMatch: 'full' },

        // Övriga sidor
        { path: 'settings', component: Settings },
        { path: 'public-archival-system', component: PublicArchivalSystem },
        { path: 'archive-structure', component: ArchiveStructure },
        { path: 'storage-unit', component: StorageUnit }
        { path: 'export-archive', component: ExportArchive }
      ]
    },
    { path: '**', redirectTo: '' }
];