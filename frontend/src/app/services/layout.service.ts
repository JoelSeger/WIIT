import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  // En signal som håller koll på om navbarens sökfält ska visas
  showNavSearch = signal(true);
}