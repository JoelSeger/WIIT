import { Component, output, HostListener, ElementRef } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-nav',
  styleUrl: './nav.scss',
  templateUrl: './nav.html',
})
export class Nav {

  constructor(private elementRef: ElementRef) {}
  
  menuIconUrl: string = '/menu.png';
  addIconUrl: string = '/add.png';
  homeIconUrl: string = '/home.png';
  downloadIconUrl: string = '/download.png';
  logoutIconUrl: string = '/logout.png';

  menuClicked = output<void>();

  openMenu(): void {
    this.menuClicked.emit();
  }

  addItem(): void {
    console.log('Add button clicked');
  }

  goHome(): void {
    console.log('Home button clicked');
  }

  download(): void {
    console.log('Download button clicked');
  }

  logout(): void {
    console.log('Logout button clicked');
  }

  // tillfällig testdata innan vi kopplar till backend
  searchItems: string[] = [
    'Arkivförteckning 2016 - 2023',
    'Arkivförteckning 2024 -',
    'Förvaringsenheter',
    'Förvaring',
    'Struktur',
    'Verksamhetssystem'
  ];

  searchText = '';
  searchSuggestions: string[] = [];

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;

    if (this.searchText.trim().length < 2) {
      this.searchSuggestions = [];
      return;
    }

    this.searchSuggestions = this.searchItems.filter(item =>
      item.toLowerCase().includes(this.searchText.trim().toLowerCase())
    );

    console.log(this.searchSuggestions);
  }

  
  selectSuggestion(item: string): void {
    this.searchText = item;
    this.searchSuggestions = [];
  }

  @HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  const searchElement = this.elementRef.nativeElement.querySelector('.nav-search');

  if (searchElement && !searchElement.contains(event.target as Node)) {
    this.searchSuggestions = [];
  }
}
}
