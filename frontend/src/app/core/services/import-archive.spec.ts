import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ImportArchiveService, toImportError } from './import-archive';

describe('ImportArchiveService', () => {
  let service: ImportArchiveService;
  let http: HttpTestingController;
  const file = new File(['<ead/>'], 'KS_IHP.ead3');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ImportArchiveService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('NF5 sends the file in the field "file" to the preview', () => {
    service.previewEadFile(file).subscribe();

    const request = http.expectOne('/api/import/ead/preview');
    expect(request.request.method).toBe('POST');
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
    request.flush({});
  });

  it('NF5 sends archiveId only when an archive is chosen', () => {
    service.uploadEadFile(file, { archiveId: 1 }).subscribe();
    service.uploadEadFile(file, { archiveId: null }).subscribe();

    const [withArchive, without] = http.match('/api/import/ead');
    expect((withArchive?.request.body as FormData).get('archiveId')).toBe('1');
    expect((without?.request.body as FormData).has('archiveId')).toBe(false);
    withArchive?.flush({});
    without?.flush({});
  });
});

describe('toImportError', () => {
  const httpError = (status: number, error: unknown): HttpErrorResponse =>
    new HttpErrorResponse({ status, error });

  it('NF5 shows the backend message and issues for a 400', () => {
    const result = toImportError(
      httpError(400, {
        error: 'EAD-filen kunde inte importeras.',
        issues: [{ message: 'Titel saknas', path: '/ead' }],
      }),
    );

    expect(result).toEqual({
      message: 'EAD-filen kunde inte importeras.',
      issues: [{ message: 'Titel saknas', path: '/ead' }],
    });
  });

  it('NF5 says the file is already imported for a 409', () => {
    const result = toImportError(
      httpError(409, { error: '"Informationshanteringsplan" är redan importerad.' }),
    );

    expect(result.message).toContain('Filen är redan importerad.');
    expect(result.message).toContain('Informationshanteringsplan');
  });

  it('F5.3 explains a 403', () => {
    expect(toImportError(httpError(403, { error: 'Forbidden' })).message).toContain('behörighet');
  });

  it('does not trust an unknown error body', () => {
    expect(toImportError(httpError(400, '<html>')).message).toBe('Filen kunde inte importeras.');
  });
});
