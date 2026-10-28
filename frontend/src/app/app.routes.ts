import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout';
import { LoginComponent } from './pages/login/login';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
    // endast för att visa login sida, ska vara startsida senare
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', redirectTo: 'settings', pathMatch: 'full' },
      { path: 'settings', component: Settings },
    ]
  },
  { path: '**', redirectTo: '' }
];