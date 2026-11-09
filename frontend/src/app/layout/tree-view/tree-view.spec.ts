import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TreeView, TreeNode } from './tree-view';

describe('TreeView', () => {
  let component: TreeView;
  let fixture: ComponentFixture<TreeView>;
  let http: HttpTestingController;

  const tree: TreeNode[] = [
    {
      id: 1, parentId: null, nodeTypeId: 1, title: 'Leda verksamhet', referenceCode: '1',
      isPublished: true, nodeType: { id: 1, name: 'Verksamhetsområde' }, values: [],
      children: [
        {
          id: 2, parentId: 1, nodeTypeId: 2, title: 'Styra verksamhet', referenceCode: '1.1',
          isPublished: true, nodeType: { id: 2, name: 'Processgrupp' }, values: [], children: [],
        },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeView],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(TreeView);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('structureId', 7);
    fixture.detectChanges();
    http.expectOne('/api/node/public/structures/7/tree').flush(tree);
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows roots expanded with reference code and title (F4.3)', () => {
    const labels = component.flatNodes().map((n) => component.getLabel(n));
    expect(labels).toEqual(['1 Leda verksamhet', '1.1 Styra verksamhet']);
  });

  it('collapses and expands a node (F4.3.1)', () => {
    component.toggle(1);
    expect(component.flatNodes().length).toBe(1);
    component.toggle(1);
    expect(component.flatNodes().length).toBe(2);
  });
});
