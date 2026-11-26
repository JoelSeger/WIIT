import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SearchService } from '../../services/search.service';
import { SearchResult } from '../../models/search';

@Component({
  imports: [],
  selector: 'app-search-results',
  styleUrl: './search-results.scss',
  templateUrl: './search-results.html',
  standalone: true,
})
export class SearchResults {
  private route = inject(ActivatedRoute);
  private searchService = inject(SearchService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  searchText: string = '';
  searchResults: SearchResult[] = [];
  totalResults: number = 0;

  currentPage: number = 1;
  pageSize: number = 20;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.searchText = params.get('q') ?? '';

      this.currentPage = Math.max(1, Number(params.get('page')) || 1);

      const offset = (this.currentPage - 1) * this.pageSize;


      if (this.searchText.trim().length >= 3) {
        this.searchService.search(this.searchText, this.pageSize, offset).subscribe(response => {
          this.searchResults = response.results;
          this.totalResults = response.total;
          this.cdr.detectChanges();
        });
      } else {
        this.searchResults = [];
        this.totalResults = 0;
        this.cdr.detectChanges();
      }
    });
  }
  // Calculates the total number of pages
  get totalPages(): number {
    return Math.ceil(this.totalResults / this.pageSize);
  }

  // Navigates to the selected search results page
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }

    this.router.navigate(['/search'], {
      queryParams: {
        q: this.searchText,
        page: page
      }
    });
  }
}
