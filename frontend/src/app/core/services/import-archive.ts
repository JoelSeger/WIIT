import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  EadIssue,
  EadPreview,
  ImportErrorBody,
  ImportResponse,
} from '../../models/ead-import.model';

const IMPORT_URL = '/api/import/ead';
const PREVIEW_URL = '/api/import/ead/preview';
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_CONFLICT = 409;

/** Options for the import. archiveId links the new structures to an archive (and its arkivbildare). */
export interface ImportOptions {
  archiveId: number | null;
}

/** A message for the user and, for a 400, the problems the backend found in the file. */
export interface ImportError {
  message: string;
  issues: EadIssue[];
}

/** NF5: talks to the backend's EAD import (Sandie's service, extended with preview and archiveId). */
@Injectable({ providedIn: 'root' })
export class ImportArchiveService {
  private readonly http = inject(HttpClient);

  /** Asks the backend what the file would create. Writes nothing to the database. */
  previewEadFile(file: File): Observable<EadPreview> {
    return this.http.post<EadPreview>(PREVIEW_URL, toFormData(file));
  }

  /** Imports the file. The backend answers 201 with the created structures. */
  uploadEadFile(file: File, options: ImportOptions): Observable<ImportResponse> {
    const formData = toFormData(file);
    if (options.archiveId !== null) {
      formData.append('archiveId', String(options.archiveId));
    }
    return this.http.post<ImportResponse>(IMPORT_URL, formData);
  }
}

/** Turns an HTTP error from the import routes into a clear message (code guidelines 5.7). */
export function toImportError(error: unknown): ImportError {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: 'Något gick fel med importen.', issues: [] };
  }
  const body = readErrorBody(error.error);
  switch (error.status) {
    case 0:
      return { message: 'Kunde inte nå servern. Kontrollera att backend är igång.', issues: [] };
    case HTTP_UNAUTHORIZED:
    case HTTP_FORBIDDEN:
      return {
        message:
          'Du har inte behörighet att importera. Logga in som redigerare ' +
          '(lokalt: sätt AUTH_DISABLED=true i backend/.env).',
        issues: [],
      };
    case HTTP_CONFLICT:
      return { message: `Filen är redan importerad. ${body?.error ?? ''}`.trim(), issues: [] };
    case HTTP_BAD_REQUEST:
      return {
        message: body?.error ?? 'Filen kunde inte importeras.',
        issues: body?.issues ?? [],
      };
    default:
      return { message: 'Servern kunde inte ta emot filen. Försök igen.', issues: [] };
  }
}

function toFormData(file: File): FormData {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

/** The body is data from outside the program, so it is checked before it is used (5.1.5). */
function readErrorBody(value: unknown): ImportErrorBody | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return null;
  }
  const { error, issues } = value as { error: unknown; issues?: unknown };
  if (typeof error !== 'string') {
    return null;
  }
  return { error, issues: Array.isArray(issues) ? issues.filter(isIssue) : [] };
}

function isIssue(value: unknown): value is EadIssue {
  return (
    typeof value === 'object' && value !== null && typeof (value as EadIssue).message === 'string'
  );
}
