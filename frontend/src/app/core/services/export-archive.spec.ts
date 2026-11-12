import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExportArchiveService, fileNameFrom, toExportError } from './export-archive';

describe('ExportArchiveService', () => {
  let service: ExportArchiveService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExportArchiveService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('NF6.1 asks for the full export only when it is chosen', () => {
    service.exportEad3(1, { full: true }).subscribe();
    service.exportEad3(2, { full: false }).subscribe();

    http.expectOne('/api/structures/1/export/ead3?full=true').flush(new Blob(['<ead/>']));
    http.expectOne('/api/structures/2/export/ead3').flush(new Blob(['<ead/>']));
  });
});

describe('export helpers', () => {
  it('NF6.1 takes the file name from Content-Disposition', () => {
    expect(fileNameFrom('attachment; filename="ihp-full.ead3.xml"')).toBe('ihp-full.ead3.xml');
    expect(fileNameFrom(null)).toBe('arkivexport.ead3.xml');
  });

  it('NF6.1 reads the backend message from a Blob error body', async () => {
    const body = new Blob([
      JSON.stringify({ error: 'Strukturen finns inte eller är inte publicerad' }),
    ]);

    const message = await toExportError(new HttpErrorResponse({ status: 404, error: body }));

    expect(message).toBe('Strukturen finns inte eller är inte publicerad');
  });

  it('F5.3 explains that the full export needs the editor role', async () => {
    const message = await toExportError(new HttpErrorResponse({ status: 403, error: null }));

    expect(message).toContain('redigerarroll');
  });

  it('says so when the backend cannot be reached', async () => {
    const message = await toExportError(new HttpErrorResponse({ status: 0 }));

    expect(message).toContain('Kunde inte nå servern');
  });
});
