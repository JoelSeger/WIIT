import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FORVARING, IHP, MAH, MAU, ihpTree } from '../../testing/tree-fixtures';
import { TreeView } from './tree-view';

/** Stands in for the pages the tree navigates to. */
@Component({ template: '' })
class EmptyPage {}

describe('TreeView', () => {
  let fixture: ComponentFixture<TreeView>;
  let http: HttpTestingController;
  let host: HTMLElement;

  const item = (key: string): HTMLElement | null =>
    host.querySelector<HTMLElement>(`[role="treeitem"][data-key="${key}"]`);

  const press = (key: string): void => {
    host.querySelector('[role="tree"]')?.dispatchEvent(new KeyboardEvent('keydown', { key }));
  };

  /** Lets the HTTP answer reach the signals and the view (zoneless change detection). */
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeView],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: EmptyPage }]),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TreeView);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    http.expectOne('/api/structures').flush({ success: true, data: [IHP, FORVARING] });
    http.expectOne('/api/archive-creators').flush({ success: true, data: [MAH, MAU] });
    await settle();
  });

  afterEach(() => http.verify());

  it('F4.3 shows a tree with the folders Struktur and Förvaring', () => {
    expect(host.querySelector('[role="tree"]')).not.toBeNull();
    expect(item('g:struktur')?.textContent).toContain('Struktur');
    expect(item('g:forvaring')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('F4.3.1 opens a folder on click and closes it with the arrow', async () => {
    item('g:struktur')?.click();
    await fixture.whenStable();

    expect(item('g:struktur')?.getAttribute('aria-expanded')).toBe('true');
    expect(item('c:1')?.textContent).toContain('Malmö universitet');

    item('g:struktur')?.querySelector<HTMLElement>('.tree-toggle')?.click();
    await fixture.whenStable();

    expect(item('g:struktur')?.getAttribute('aria-expanded')).toBe('false');
    expect(item('c:1')).toBeNull();
  });

  it('F4.3 fetches the nodes of a structure the first time it is opened', async () => {
    item('g:struktur')?.click();
    await fixture.whenStable();
    item('c:1')?.click();
    await fixture.whenStable();
    item('s:1')?.click();
    await fixture.whenStable();

    http.expectOne('/api/node/public/structures/1/tree').flush(ihpTree());
    await settle();

    expect(item('n:10')?.textContent).toContain('4 - Bedriva forskning');
  });

  it('NF8 / 5.8 can be used with the keyboard only', async () => {
    item('g:struktur')?.focus();
    press('ArrowRight');
    await fixture.whenStable();
    expect(item('g:struktur')?.getAttribute('aria-expanded')).toBe('true');

    press('ArrowDown');
    await fixture.whenStable();
    expect(item('c:2')?.getAttribute('tabindex')).toBe('0');

    press('ArrowLeft');
    await fixture.whenStable();
    expect(item('g:struktur')?.getAttribute('tabindex')).toBe('0');
  });
});
