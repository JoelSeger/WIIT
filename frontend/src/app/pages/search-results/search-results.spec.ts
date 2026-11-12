import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { SearchResponse } from '../../models/search.model';
import { PAGE_SIZE, SearchResults } from './search-results';

function response(total: number): SearchResponse {
  return {
    query: 'HT7',
    total,
    truncated: false,
    limit: PAGE_SIZE,
    offset: 0,
    results: [
      {
        nodeId: 5,
        structureId: 1,
        structureName: 'Informationshanteringsplan',
        structureType: 'klassificering',
        title: 'Avtal',
        referenceCode: 'HT7',
        nodeType: { code: 'handlingstyp', name: 'Handlingstyp' },
        path: [{ id: 10, title: 'Köpa in varor och tjänster', referenceCode: '2.3.3' }],
        matches: [{ field: 'property', label: 'Gallras', snippet: 'Gallras 2 år efter …' }],
      },
    ],
  };
}

describe('SearchResults', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let page: SearchResults;

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl(url, SearchResults);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'search', component: SearchResults }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('F4.1 asks the backend for page 2 with offset 20', async () => {
    await open('/search?q=HT7&page=2');
    http
      .expectOne(`/api/search?q=HT7&limit=${PAGE_SIZE}&offset=${PAGE_SIZE}`)
      .flush({ success: true, data: response(57) });
    await harness.fixture.whenStable();

    expect(page.totalPages()).toBe(3);
    expect(page.firstHit()).toBe(21);
    expect(page.lastHit()).toBe(40);
  });

  it('F4.1 does not search with fewer than 2 characters', async () => {
    await open('/search?q=H');

    http.expectNone((request) => request.url === '/api/search');
    expect(page.isTooShort()).toBe(true);
  });

  it('F4.2 links a hit to its node page and shows where it sits', async () => {
    await open('/search?q=HT7');
    http
      .expectOne(`/api/search?q=HT7&limit=${PAGE_SIZE}`)
      .flush({ success: true, data: response(1) });
    await harness.fixture.whenStable();

    const hit = response(1).results[0];
    expect(hit).toBeDefined();
    if (!hit) {
      return;
    }
    expect(page.resultLink(hit)).toEqual(['/structures', 1, 'nodes', 5]);
    expect(page.pathText(hit)).toBe(
      'Informationshanteringsplan / 2.3.3 Köpa in varor och tjänster',
    );
    const link = harness.routeNativeElement?.querySelector('a.result-title');
    expect(link?.getAttribute('href')).toBe('/structures/1/nodes/5');
    expect(harness.routeNativeElement?.textContent).toContain('Gallras 2 år efter');
  });

  it('shows a message when the search fails', async () => {
    await open('/search?q=HT7');
    http
      .expectOne(`/api/search?q=HT7&limit=${PAGE_SIZE}`)
      .flush({ error: 'fel' }, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();

    expect(page.hasError()).toBe(true);
  });
});
