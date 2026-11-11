import { Component, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MIN_SEARCH_LENGTH, SearchService } from '../../core/services/search.service';
import type { SearchResult } from '../../models/search.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-public-archival-system',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-archival-system.html',
  styleUrl: './public-archival-system.scss'
})
export class PublicArchivalSystem {

  searchText: string = '';
  searchResults: SearchResult[] = [];
  searchCompleted: boolean = false;

  private searchSubject = new Subject<string>();
  private searchService = inject(SearchService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  /** Suggestions shown under the field; Enter opens the result page with all hits. */
  private static readonly SUGGESTION_LIMIT = 10;

  // Handles search requests with debounce
  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 3) {
          return of(null);
        }
        // catchError keeps the search working after a failed request
        return this.searchService.search(query, PublicArchivalSystem.SUGGESTION_LIMIT).pipe(
          catchError(error => {
            console.error('Search failed:', error);
            return of(null);
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.searchResults = response?.results ?? [];
      this.searchCompleted = response !== null;
      this.cdr.detectChanges();
    });
  }

  
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;

    this.searchCompleted = false;

    if (this.searchText.trim().length < 3) {
      this.searchResults = [];
    }

    this.searchSubject.next(this.searchText.trim());
  }

  // F4.2: a hit opens its node page, which also opens the path in the tree view
  selectSearchResult(result: SearchResult): void {
    void this.router.navigate(['/structures', result.structureId, 'nodes', result.nodeId]);
  }

  // F4.1: Enter opens the result page with all hits (/search?q=…)
  submitSearch(): void {
    const query = this.searchText.trim();
    if (query.length < MIN_SEARCH_LENGTH) return;
    void this.router.navigate(['/search'], { queryParams: { q: query, page: 1 } });
  }
}