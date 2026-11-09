import { Component, inject, output, HostListener, ElementRef, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LoginService } from '../../core/services/login.service';
import { SearchService } from '../../services/search.service';
import { SearchResult } from '../../models/search';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  imports: [RouterLink],
  standalone: true,
  selector: 'app-nav',
  styleUrl: './nav.scss',
  templateUrl: './nav.html',
})
export class Nav {

  loginService = inject(LoginService);
  constructor(private elementRef: ElementRef) {}
  
  menuIconUrl: string = '/menu.png';
  addIconUrl: string = '/add.png';
  homeIconUrl: string = '/home.png';
  downloadIconUrl: string = '/download.png';
  logoutIconUrl: string = '/logout.png';
  loginIconUrl: string = '/login.png';

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


  searchText = '';
  searchSuggestions: SearchResult[] = [];
  searchCompleted: boolean = false;

  private searchSubject = new Subject<string>();
  private searchService = inject(SearchService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  // Handles search requests with debounce
  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 3) {
          return of(null);
        }

        return this.searchService.search(query).pipe(
          catchError(error => {
            console.error('Search failed:', error);
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.searchSuggestions = response?.results ?? [];
      this.searchCompleted = response !== null;
      this.cdr.detectChanges();
    });
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;

    this.searchCompleted = false;

    if (this.searchText.trim().length < 3) {
      this.searchSuggestions = [];
    }
    this.searchSubject.next(this.searchText.trim());
  }

  
  selectSuggestion(result: SearchResult): void {
    console.log('Selected search result:', result);
    this.searchText = result.title;
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
