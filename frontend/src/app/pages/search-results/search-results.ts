import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { type Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { MIN_SEARCH_LENGTH, SearchService } from '../../core/services/search.service';
import type { SearchMatch, SearchResponse, SearchResult } from '../../models/search.model';

/** Hits per page. The backend allows 1–100. */
export const PAGE_SIZE = 20;

interface SearchRequest {
  query: string;
  page: number;
}

/**
 * F4.1 / F4.2: result page for the search, /search?q=HT7&page=2 (the improvement asked for at
 * the demo 10/11, adapted to demo_test). The word and the page are in the address, so the back
 * button, a reload or a shared link show the same page. A hit opens the node page, which opens
 * the path to the node in the tree view.
 */
@Component({
  selector: 'app-search-results',
  imports: [RouterLink],
  templateUrl: './search-results.html',
  styleUrl: './search-results.scss',
})
export class SearchResults {
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);

  readonly query = signal('');
  readonly page = signal(1);
  readonly response = signal<SearchResponse | null>(null);
  readonly isLoading = signal(false);
  readonly hasError = signal(false);

  readonly totalPages = computed(() => {
    const response = this.response();
    return response ? Math.max(1, Math.ceil(response.total / PAGE_SIZE)) : 1;
  });

  /** Number of the first and last hit on this page, e.g. 21 and 40. */
  readonly firstHit = computed(() => (this.page() - 1) * PAGE_SIZE + 1);
  readonly lastHit = computed(() => {
    const response = this.response();
    return response ? Math.min(this.page() * PAGE_SIZE, response.total) : 0;
  });

  readonly isTooShort = computed(() => this.query().length < MIN_SEARCH_LENGTH);

  constructor() {
    inject(ActivatedRoute)
      .queryParamMap.pipe(
        map((params): SearchRequest => ({
          query: (params.get('q') ?? '').trim(),
          page: Math.max(1, Math.trunc(Number(params.get('page'))) || 1),
        })),
        tap((request) => this.startRequest(request)),
        switchMap((request) => this.fetch(request)),
        takeUntilDestroyed(),
      )
      .subscribe((response) => this.showResponse(response));
  }

  /** Link to the hit's node page. */
  resultLink(result: SearchResult): (string | number)[] {
    return ['/structures', result.structureId, 'nodes', result.nodeId];
  }

  /** Path down to the hit's parent, e.g. "Informationshanteringsplan / 2.3 Hantera ekonomi". */
  pathText(result: SearchResult): string {
    const steps = result.path.map((p) =>
      p.referenceCode ? `${p.referenceCode} ${p.title}` : p.title,
    );
    return [result.structureName, ...steps].join(' / ');
  }

  /** Hits in a description or a field, shown under the title (the title itself is already shown). */
  extraMatches(result: SearchResult): SearchMatch[] {
    return result.matches.filter((m) => m.field === 'description' || m.field === 'property');
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) {
      return;
    }
    void this.router.navigate(['/search'], { queryParams: { q: this.query(), page } });
    window.scrollTo?.({ top: 0 });
  }

  private startRequest(request: SearchRequest): void {
    this.query.set(request.query);
    this.page.set(request.page);
    this.hasError.set(false);
  }

  private fetch(request: SearchRequest): Observable<SearchResponse | null> {
    if (request.query.length < MIN_SEARCH_LENGTH) {
      return of(null);
    }
    this.isLoading.set(true);
    const offset = (request.page - 1) * PAGE_SIZE;
    return this.searchService.search(request.query, PAGE_SIZE, offset).pipe(
      catchError(() => {
        this.hasError.set(true);
        return of(null);
      }),
    );
  }

  private showResponse(response: SearchResponse | null): void {
    this.response.set(response);
    this.isLoading.set(false);
    // A page number that is too high (typed in the address) goes to the last page instead
    if (response && response.total > 0 && this.page() > this.totalPages()) {
      this.goToPage(this.totalPages());
    }
  }
}
