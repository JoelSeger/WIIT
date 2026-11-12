import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StructureService } from '../../core/services/structure.service';
import type { EadPreview } from '../../models/ead-import.model';
import { MAH, MAU } from '../../testing/tree-fixtures';
import { ImportArchiveComponent } from './import-archive';

const EAD3 =
  '<ead xmlns="http://ead3.archivists.org/schema/"><control/><archdesc level="otherlevel"/></ead>';
const RA_EAD = '<ead xmlns="http://xml.ra.se/EAD"><eadheader/><archdesc level="fonds"/></ead>';

const VALID_PREVIEW: EadPreview = {
  valid: true,
  metadata: {
    recordId: 'KS',
    titleProper: 'IHP',
    agencyName: 'Malmö universitet',
    eadVersion: 'EAD3',
  },
  trees: [{ name: 'Informationshanteringsplan', structureType: 'klassificering', nodeCount: 1343 }],
  nodeCount: 1343,
  errors: [],
  warnings: [],
};

describe('ImportArchiveComponent', () => {
  let fixture: ComponentFixture<ImportArchiveComponent>;
  let component: ImportArchiveComponent;
  let http: HttpTestingController;

  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportArchiveComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ImportArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/archive-creators').flush({ success: true, data: [MAH, MAU] });
    await settle();
  });

  afterEach(() => http.verify());

  it('NF5 accepts a .ead3 file and shows what will be imported', async () => {
    const checking = component.handleFile(new File([EAD3], 'KS_IHP.ead3'));
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/import/ead/preview').flush(VALID_PREVIEW);
    await checking;
    await settle();

    expect(component.errorMessage()).toBeNull();
    expect(component.canImport()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Informationshanteringsplan',
    );
  });

  it('NF5 stops RA-EAD before anything is sent to the backend', async () => {
    await component.handleFile(new File([RA_EAD], 'GV.ead'));

    http.expectNone('/api/import/ead/preview');
    expect(component.errorMessage()).toContain('RA-EAD');
    expect(component.canImport()).toBe(false);
  });

  it('NF5 does not allow import when the preview finds errors', async () => {
    const checking = component.handleFile(new File([EAD3], 'KS_IHP.ead3'));
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/import/ead/preview').flush({
      ...VALID_PREVIEW,
      valid: false,
      errors: [{ message: 'The EAD document title is missing.' }],
    });
    await checking;

    expect(component.canImport()).toBe(false);
    expect(component.issues()).toHaveLength(1);
  });

  it('NF5 imports with the chosen archive and refreshes the tree view', async () => {
    const reset = vi.spyOn(TestBed.inject(StructureService), 'reset');
    const checking = component.handleFile(new File([EAD3], 'KS_IHP.ead3'));
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/import/ead/preview').flush(VALID_PREVIEW);
    await checking;

    // Malmö universitet has the only archive, so it is chosen from the start
    expect(component.selectedArchiveId()).toBe(1);

    const importing = component.onSubmit(new Event('submit'));
    const request = http.expectOne('/api/import/ead');
    expect((request.request.body as FormData).get('archiveId')).toBe('1');
    request.flush(
      {
        structures: [
          {
            id: 3,
            code: 'ks',
            name: 'Informationshanteringsplan',
            structureType: 'klassificering',
            nodeCount: 1343,
          },
        ],
        relationCount: 192,
        createdNodeTypes: [],
        warnings: [],
      },
      { status: 201, statusText: 'Created' },
    );
    await importing;

    expect(component.importResult()?.structures[0]?.id).toBe(3);
    expect(reset).toHaveBeenCalled();
  });

  it('NF5 says so when the file is already imported (409)', async () => {
    const checking = component.handleFile(new File([EAD3], 'KS_IHP.ead3'));
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/import/ead/preview').flush(VALID_PREVIEW);
    await checking;

    const importing = component.onSubmit(new Event('submit'));
    http
      .expectOne('/api/import/ead')
      .flush({ error: 'Redan importerad som id 1.' }, { status: 409, statusText: 'Conflict' });
    await importing;

    expect(component.errorMessage()).toContain('Filen är redan importerad.');
    expect(component.isUploading()).toBe(false);
  });
});
