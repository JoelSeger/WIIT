import { HttpClient, HttpErrorResponse, HttpParams, type HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const FALLBACK_FILE_NAME = 'arkivexport.ead3.xml';

export interface ExportOptions {
  /** true: also unpublished nodes and internal fields (needs the editor role). */
  full: boolean;
}

/** NF6.1: EAD3 export of one structure (Yasmin's export, moved into a service). */
@Injectable({ providedIn: 'root' })
export class ExportArchiveService {
  private readonly http = inject(HttpClient);

  /** GET /api/structures/:id/export/ead3. The whole response is returned so the file name can be read. */
  exportEad3(structureId: number, options: ExportOptions): Observable<HttpResponse<Blob>> {
    const params = options.full ? new HttpParams().set('full', 'true') : new HttpParams();
    return this.http.get(`/api/structures/${structureId}/export/ead3`, {
      params,
      responseType: 'blob',
      observe: 'response',
    });
  }
}

/** File name from Content-Disposition, e.g. attachment; filename="ihp-full.ead3.xml". */
export function fileNameFrom(contentDisposition: string | null): string {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? FALLBACK_FILE_NAME;
}

/** Saves a downloaded file in the browser's download folder. */
export function saveFile(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Removed a little later, so the browser has time to start the download
  setTimeout(() => URL.revokeObjectURL(url));
}

/**
 * A clear message for a failed export (code guidelines 5.7). With responseType 'blob'
 * the JSON error body also arrives as a Blob, so it is read as text first.
 */
export async function toExportError(error: unknown): Promise<string> {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Exporten misslyckades.';
  }
  if (error.status === 0) {
    return 'Kunde inte nå servern. Kontrollera att backend är igång.';
  }
  if (error.status === HTTP_UNAUTHORIZED || error.status === HTTP_FORBIDDEN) {
    return (
      'Fullständig export kräver redigerarroll. Ta bort bocken för fullständig export, ' +
      'eller sätt AUTH_DISABLED=true i backend/.env lokalt.'
    );
  }
  const backendMessage = await readErrorMessage(error.error);
  if (error.status === HTTP_NOT_FOUND) {
    return backendMessage ?? 'Strukturen finns inte eller är inte publicerad.';
  }
  if (error.status === HTTP_BAD_REQUEST) {
    return backendMessage ?? 'Ogiltig struktur.';
  }
  return 'Exporten misslyckades på servern. Försök igen.';
}

async function readErrorMessage(body: unknown): Promise<string | null> {
  try {
    const text = body instanceof Blob ? await body.text() : null;
    const parsed: unknown = text ? JSON.parse(text) : body;
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      const message = (parsed as { error: unknown }).error;
      return typeof message === 'string' ? message : null;
    }
    return null;
  } catch {
    // Not JSON (e.g. an HTML error page): fall back to the general message
    return null;
  }
}
