import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FORVARING, IHP, MAH, MAU } from '../../testing/tree-fixtures';
import { ArchiveStructure } from './archive-structure';

describe('ArchiveStructure', () => {
  let fixture: ComponentFixture<ArchiveStructure>;
  let http: HttpTestingController;

  const links = (): Array<[string, string | null]> =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.archive-cards a')).map(
      (a) => [a.textContent?.trim() ?? '', a.getAttribute('href')],
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveStructure],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ArchiveStructure);
    fixture.detectChanges();
    http.expectOne('/api/structures').flush({ success: true, data: [IHP, FORVARING] });
    http.expectOne('/api/archive-creators').flush({ success: true, data: [MAH, MAU] });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('F4.3 shows one card per arkivbildare from the backend', () => {
    expect(links().map(([name]) => name)).toEqual([
      'Malmö högskola 1998–2015',
      'Malmö universitet',
    ]);
  });

  it('F4.3 Malmö universitet opens its Informationshanteringsplan directly', () => {
    // Förvaringsenheter (2) is a Förvaring tree, so the IHP is the only one under Struktur
    expect(links()).toContainEqual(['Malmö universitet', '/structures/1']);
  });

  it('F4.3 an arkivbildare without one single structure opens its own page', () => {
    expect(links()).toContainEqual(['Malmö högskola 1998–2015', '/archive-creators/2']);
  });
});
