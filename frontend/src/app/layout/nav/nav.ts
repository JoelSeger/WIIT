import { Component, inject, output, HostListener, ElementRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  type Observable,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';
import { LoginService } from '../../core/services/login.service';
import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  SearchService,
} from '../../core/services/search.service';
import type { SearchResult } from '../../models/search.model';

const SEARCH_DEBOUNCE_MS = 250;
const SUGGESTION_LIMIT = 8;

type SearchOutcome =
  | { kind: 'results'; results: SearchResult[]; total: number }
  | { kind: 'cleared' }
  | { kind: 'failed' };

@Component({
  imports: [RouterLink],
  standalone: true,
  selector: 'app-nav',
  styleUrl: './nav.scss',
  templateUrl: './nav.html',
})
export class Nav {
  loginService = inject(LoginService);

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

  // F4.1: suggestions come from the backend search (GET /api/search)
  private readonly searchService = inject(SearchService);
  private readonly router = inject(Router);
  private readonly searchTerms = new Subject<string>();

  searchText = '';
  readonly searchSuggestions = signal<SearchResult[]>([]);
  readonly searchMessage = signal('');
  /** All hits for the term, so the list can offer "Visa alla N träffar". */
  readonly searchTotal = signal(0);
  /** true after Enter, so a late suggestion answer does not open the list over the result page. */
  private suggestionsClosed = false;

  constructor(private elementRef: ElementRef) {
    this.searchTerms
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((term) => this.runSearch(term)),
        takeUntilDestroyed(),
      )
      .subscribe((outcome) => this.showOutcome(outcome));
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;
    this.suggestionsClosed = false;
    this.searchTerms.next(this.searchText.trim());
  }

  /** Enter or "Visa alla träffar": opens the result page with all hits, 20 per page. */
  submitSearch(): void {
    const query = this.searchText.trim();
    if (query.length < MIN_SEARCH_LENGTH || query.length > MAX_SEARCH_LENGTH) {
      return;
    }
    this.suggestionsClosed = true;
    this.clearSuggestions();
    void this.router.navigate(['/search'], { queryParams: { q: query, page: 1 } });
  }

  /** F4.2: opens the hit; the node page then opens its path in the tree view. */
  selectSuggestion(item: SearchResult): void {
    this.searchText = item.title;
    this.clearSuggestions();
    void this.router.navigate(['/structures', item.structureId, 'nodes', item.nodeId]);
  }

  /** Where the hit sits, e.g. "Informationshanteringsplan / 4 Bedriva forskning". */
  suggestionPath(item: SearchResult): string {
    return [item.structureName, ...item.path.map((p) => p.title)].join(' / ');
  }

  private runSearch(term: string): Observable<SearchOutcome> {
    if (term.length < MIN_SEARCH_LENGTH || term.length > MAX_SEARCH_LENGTH) {
      return of({ kind: 'cleared' });
    }
    return this.searchService.search(term, SUGGESTION_LIMIT).pipe(
      map((response): SearchOutcome => ({
        kind: 'results',
        results: response.results,
        total: response.total,
      })),
      catchError(() => of<SearchOutcome>({ kind: 'failed' })),
    );
  }

  private showOutcome(outcome: SearchOutcome): void {
    if (this.suggestionsClosed) {
      return;
    }
    if (outcome.kind === 'results') {
      this.searchSuggestions.set(outcome.results);
      this.searchTotal.set(outcome.total);
      this.searchMessage.set(outcome.results.length === 0 ? 'Inga träffar' : '');
    } else {
      this.searchSuggestions.set([]);
      this.searchMessage.set(outcome.kind === 'failed' ? 'Sökningen misslyckades' : '');
    }
  }

  private clearSuggestions(): void {
    this.searchSuggestions.set([]);
    this.searchMessage.set('');
    this.searchTotal.set(0);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const searchElement = this.elementRef.nativeElement.querySelector('.nav-search');

    if (searchElement && !searchElement.contains(event.target as Node)) {
      this.clearSuggestions();
    }
  }
}
