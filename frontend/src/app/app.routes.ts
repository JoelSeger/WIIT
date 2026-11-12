import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { LoginComponent } from './pages/login/login';
import { Settings } from './pages/settings/settings';
import { PublicArchivalSystem } from './pages/public-archival-system/public-archival-system';
import { ArchiveStructure } from './pages/archive-structure/archive-structure';
import { StorageUnit } from './pages/storage-unit/storage-unit';
import { ExportArchive } from './pages/export-archive/export-archive';
import { NodeView } from './pages/node-view/node-view';
import { ArchiveCreatorView } from './pages/archive-creator-view/archive-creator-view';
import { ImportArchiveComponent } from './pages/import-archive/import-archive';
import { SearchResults } from './pages/search-results/search-results';

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
        { path: 'storage-unit', component: StorageUnit },
        { path: 'export-archive', component: ExportArchive },
        { path: 'import-archive', component: ImportArchiveComponent },
        // F4.1: all hits for a search, /search?q=…&page=…
        { path: 'search', component: SearchResults },

        // F4.3: a structure or one node in it, opened from the tree view, the cards or a search hit
        { path: 'structures/:structureId', component: NodeView },
        { path: 'structures/:structureId/nodes/:nodeId', component: NodeView },
        { path: 'archive-creators/:creatorId', component: ArchiveCreatorView }
      ]
    },
    { path: '**', redirectTo: '' }
];