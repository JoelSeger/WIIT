import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TreeStateService } from '../../core/services/tree-state.service';
import { IHP, MAU, ihpTree } from '../../testing/tree-fixtures';
import { NodeView } from './node-view';

describe('NodeView', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  const text = (): string => harness.routeNativeElement?.textContent ?? '';

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    http.expectOne('/api/structures').flush({ success: true, data: [IHP] });
    http.expectOne('/api/archive-creators').flush({ success: true, data: [MAU] });
    http.expectOne('/api/node/public/structures/1/tree').flush(ihpTree());
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
        provideRouter([
          { path: 'structures/:structureId', component: NodeView },
          { path: 'structures/:structureId/nodes/:nodeId', component: NodeView },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('F3.6 shows the node, its type and its children as cards', async () => {
    await open('/structures/1/nodes/11');

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      '4.2 - Förbereda forskning',
    );
    expect(text()).toContain('Allmänt');
    expect(harness.routeNativeElement?.querySelectorAll('.card').length).toBe(1);
  });

  it('F4.2 opens the path to the node in the tree view', async () => {
    await open('/structures/1/nodes/12');

    const treeState = TestBed.inject(TreeStateService);
    expect(treeState.selectedKey()).toBe('n:12');
    expect(treeState.isExpanded('n:10')).toBe(true);
    expect(treeState.isExpanded('n:11')).toBe(true);
    expect(treeState.isExpanded('c:1')).toBe(true);
  });

  it('F4.3 starts the breadcrumb with the arkivbildare', async () => {
    await open('/structures/1/nodes/12');

    const crumbs = harness.routeNativeElement?.querySelectorAll('.breadcrumb a') ?? [];
    expect(Array.from(crumbs).map((a) => a.textContent?.trim())).toEqual([
      'Malmö universitet',
      'Informationshanteringsplan',
      '4 - Bedriva forskning',
      '4.2 - Förbereda forskning',
    ]);
  });

  it('F4.3 shows the top nodes when a whole structure is opened', async () => {
    await open('/structures/1');

    expect(text()).toContain('Informationshanteringsplan');
    expect(text()).toContain('4 - Bedriva forskning');
  });

  it('F5.4 says so when a node is missing or not published', async () => {
    await open('/structures/1/nodes/999');

    expect(text()).toContain('Noden finns inte, eller så är den inte publicerad.');
  });
});
