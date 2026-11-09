import { Component, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { SearchService } from '../../services/search.service';
import { SearchResult } from '../../models/search';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-public-archival-system',
  standalone: true,
  imports: [],
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

  // Handles search requests with debounce
  ngOnInit(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        return query.length >= 3
          ? this.searchService.search(query)
          : of(null);
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

  // Handles clicks on search results (navigation will be added later)
  selectSearchResult(result: SearchResult): void {
    console.log('Selected search result:' , result);
  }
}