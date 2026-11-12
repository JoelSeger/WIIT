import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { FORVARING, IHP } from '../../testing/tree-fixtures';
import { ExportArchive } from './export-archive';

describe('ExportArchive', () => {
  let http: HttpTestingController;
  let page: ExportArchive;

  async function open(url: string): Promise<void> {
    const harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl(url, ExportArchive);
    http.expectOne('/api/structures').flush({ success: true, data: [IHP, FORVARING] });
    await harness.fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'export-archive', component: ExportArchive }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('NF6.1 chooses the structure given in the address', async () => {
    await open('/export-archive?structure=2');

    expect(page.selectedStructureId()).toBe(2);
  });

  it('NF6.1 chooses the first structure when none is given', async () => {
    await open('/export-archive');

    expect(page.selectedStructureId()).toBe(IHP.id);
    expect(page.canExport()).toBe(true);
  });

  it('NF6.1 shows the popup after the file is downloaded', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await open('/export-archive');

    const exporting = page.exportArchive();
    http.expectOne('/api/structures/1/export/ead3?full=true').flush(new Blob(['<ead/>']), {
      headers: { 'Content-Disposition': 'attachment; filename="ihp-full.ead3.xml"' },
    });
    await exporting;

    expect(page.notification()).toEqual({
      type: 'success',
      message: 'Arkivinformationen har exporterats till ihp-full.ead3.xml.',
    });
  });

  it('NF6.1 shows the backend message when the export fails', async () => {
    await open('/export-archive');

    const exporting = page.exportArchive();
    http
      .expectOne('/api/structures/1/export/ead3?full=true')
      .flush(
        new Blob([JSON.stringify({ error: 'Strukturen finns inte eller är inte publicerad' })]),
        {
          status: 404,
          statusText: 'Not Found',
        },
      );
    await exporting;

    expect(page.notification()?.type).toBe('error');
    expect(page.notification()?.message).toBe('Strukturen finns inte eller är inte publicerad');
  });
});
