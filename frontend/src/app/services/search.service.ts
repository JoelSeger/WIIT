import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { SearchResponse } from '../models/search';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private http = inject(HttpClient);

  // Sends a search request to the backend
  search(query: string): Observable<SearchResponse> {
    return this.http.get<{ success: boolean; data: SearchResponse }>(
      '/api/search',
      { params: { q: query } }
    ).pipe(
      map(response => response.data)
    );
  }

}
