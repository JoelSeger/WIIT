import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TreeStateService } from '../../core/services/tree-state.service';
import { FORVARING, IHP, MAH, MAU } from '../../testing/tree-fixtures';
import { ArchiveCreatorView } from './archive-creator-view';

describe('ArchiveCreatorView', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const text = (): string => harness.routeNativeElement?.textContent ?? '';

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    http.expectOne('/api/structures').flush({ success: true, data: [IHP, FORVARING] });
    http.expectOne('/api/archive-creators').flush({ success: true, data: [MAH, MAU] });
    // Let the HTTP answers reach the signals and the view (zoneless change detection)
    await harness.fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'archive-creators/:creatorId', component: ArchiveCreatorView }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('F4.3 shows the structures of the arkivbildare grouped by type', async () => {
    await open('/archive-creators/1');

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Malmö universitet',
    );
    expect(text()).toContain('Klassificeringsstruktur');
    expect(text()).toContain('Informationshanteringsplan (version 2)');
    expect(text()).toContain('Förvaringsenheter');
  });

  it('F4.3 says so when the arkivbildare has no structures yet', async () => {
    await open('/archive-creators/2');

    expect(text()).toContain('1998–2015');
    expect(text()).toContain('Det finns inga strukturer kopplade till den här arkivbildaren ännu.');
  });

  it('F4.2 selects the arkivbildare in the tree view', async () => {
    await open('/archive-creators/2');

    expect(TestBed.inject(TreeStateService).selectedKey()).toBe('c:2');
  });
});
