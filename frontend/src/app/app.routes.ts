import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { ExportArchive } from './pages/export-archive/export-archive';

export const routes: Routes = [
    // endast för att visa login sida, ska vara startsida senare
  { path: '', component: LoginComponent },

// Exportsidan
  { path: 'export-archive', component: ExportArchive }
];