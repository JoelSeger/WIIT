import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FORVARING, IHP, ihpTree } from '../../testing/tree-fixtures';
import { LoginService } from './login.service';
import { StructureService } from './structure.service';

describe('StructureService', () => {
  let service: StructureService;
  let http: HttpTestingController;
  let login: LoginService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StructureService);
    http = TestBed.inject(HttpTestingController);
    login = TestBed.inject(LoginService);
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('F4.3 fetches the structure list and unwraps { success, data }', async () => {
    const done = service.loadStructures();
    http.expectOne('/api/structures').flush({ success: true, data: [IHP] });
    await done;

    expect(service.structures()).toEqual({ status: 'loaded', data: [IHP] });
  });

  it('F5.4 asks for the public tree when nobody is logged in', async () => {
    const done = service.loadTree(1);
    http.expectOne('/api/node/public/structures/1/tree').flush(ihpTree());
    await done;

    expect(service.treeState(1).status).toBe('loaded');
  });

  it('F5.4 falls back to the public tree when the backend refuses the editor tree', async () => {
    login.login('arkivarie@mau.se');
    TestBed.tick();

    const done = service.loadTree(1);
    http
      .expectOne('/api/node/structures/1/tree')
      .flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await Promise.resolve();
    http.expectOne('/api/node/public/structures/1/tree').flush(ihpTree());
    await done;

    expect(service.treeState(1).status).toBe('loaded');
  });

  it('F4.3 fetches a tree only once', async () => {
    const first = service.loadTree(1);
    const second = service.loadTree(1);
    http.expectOne('/api/node/public/structures/1/tree').flush(ihpTree());
    await Promise.all([first, second]);

    await service.loadTree(1);
    http.expectNone('/api/node/public/structures/1/tree');
  });

  it('shows a clear message when the server cannot be reached', async () => {
    const done = service.loadTree(1);
    http
      .expectOne('/api/node/public/structures/1/tree')
      .error(new ProgressEvent('error'), { status: 0 });
    await done;

    expect(service.treeState(1)).toEqual({
      status: 'error',
      message: 'Kunde inte nå servern. Kontrollera att backend är igång.',
    });
  });

  it('F5.4 uses the editor tree for an unpublished structure the backend already listed', async () => {
    const list = service.loadStructures();
    http
      .expectOne('/api/structures')
      .flush({ success: true, data: [{ ...FORVARING, isPublished: false }] });
    await list;

    const done = service.loadTree(FORVARING.id);
    http.expectOne(`/api/node/structures/${FORVARING.id}/tree`).flush([]);
    await done;

    expect(service.treeState(FORVARING.id).status).toBe('loaded');
  });
});
