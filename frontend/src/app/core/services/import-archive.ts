import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ImportResponse {
  structures: { id: number; name: string; nodeCount: number }[];
  relationCount: number;
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class ImportArchiveService {
  private http = inject(HttpClient);
  private apiUrl = '/api/import/ead';

    uploadEadFile(file: File): Observable<ImportResponse> {
      const formData = new FormData();
      formData.append('file', file);

      return this.http.post<ImportResponse>(this.apiUrl, formData);
    }
  }