import { Component, inject, DestroyRef } from '@angular/core';
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

  private searchSubject = new Subject<string>();
  private searchService = inject(SearchService);
  private destroyRef = inject(DestroyRef);

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
    });
  }

  // Updates the search text when the user types
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchText = input.value;

    if (this.searchText.trim().length < 3) {
      this.searchResults = [];
    }

    this.searchSubject.next(this.searchText.trim());
  }
}