import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import type { SearchResponse } from '../../models/search.model';
import type { ApiResponse } from '../../models/structure.model';

const SEARCH_URL = '/api/search';

/** Same limits as the backend (searchController.ts). */
export const MIN_SEARCH_LENGTH = 2;
export const MAX_SEARCH_LENGTH = 200;

/**
 * F4.1: cross-tree search. The backend decides what the user may see (public or editor),
 * so the frontend sends the same request for everyone.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);

  /**
   * Searches titles, reference codes, descriptions and field values in all structures.
   * offset skips hits for paging, e.g. page 2 with 20 per page = offset 20.
   */
  search(query: string, limit: number, offset = 0): Observable<SearchResponse> {
    let params = new HttpParams().set('q', query.trim()).set('limit', limit);
    if (offset > 0) {
      params = params.set('offset', offset);
    }
    return this.http
      .get<ApiResponse<SearchResponse>>(SEARCH_URL, { params })
      .pipe(map((response) => response.data));
  }
}
