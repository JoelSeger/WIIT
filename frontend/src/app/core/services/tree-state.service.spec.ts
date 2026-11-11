import { TestBed } from '@angular/core/testing';
import { FORVARING, IHP, MAU } from '../../testing/tree-fixtures';
import {
  TreeStateService,
  creatorChain,
  groupForStructureType,
  structureContainerKeys,
} from './tree-state.service';

describe('TreeStateService', () => {
  let service: TreeStateService;

  beforeEach(() => {
    service = TestBed.inject(TreeStateService);
  });

  it('F4.3.1 opens a closed row and closes an open row', () => {
    service.toggle('n:1');
    expect(service.isExpanded('n:1')).toBe(true);

    service.toggle('n:1');
    expect(service.isExpanded('n:1')).toBe(false);
  });

  it('F4.2 opens the folder, the structure and all ancestors of a search hit', () => {
    service.revealNode({
      containerKeys: ['g:forvaring'],
      structureId: 2,
      ancestorIds: [20, 21],
      nodeId: 22,
    });

    expect([...service.expanded()]).toEqual(['g:forvaring', 's:2', 'n:20', 'n:21']);
    expect(service.selectedKey()).toBe('n:22');
  });

  it('F4.3 places klassificering and arkivförteckning under Struktur, förvaring under Förvaring', () => {
    expect(groupForStructureType('klassificering')?.key).toBe('struktur');
    expect(groupForStructureType('arkivforteckning')?.key).toBe('struktur');
    expect(groupForStructureType('forvaring')?.key).toBe('forvaring');
    expect(groupForStructureType('okand')).toBeNull();
  });

  it('F4.2 the path to a structure goes through its arkivbildare under Struktur, not under Förvaring', () => {
    expect(structureContainerKeys(IHP, [MAU])).toEqual(['g:struktur', 'c:1']);
    expect(structureContainerKeys(FORVARING, [MAU])).toEqual(['g:forvaring']);
    expect(structureContainerKeys(IHP, [])).toEqual(['g:struktur']);
  });

  it('F4.3 finds parent arkivbildare and stops at a loop', () => {
    const faculty = { ...MAU, id: 5, parentId: 1, name: 'Fakulteten för lärande och samhälle' };
    expect(creatorChain(5, [MAU, faculty]).map((c) => c.id)).toEqual([1, 5]);

    const loop = [{ ...MAU, parentId: 5 }, faculty];
    expect(creatorChain(5, loop).map((c) => c.id)).toEqual([1, 5]);
  });

  it('F4.3 opens Struktur and selects the arkivbildare', () => {
    service.revealCreator(1, [MAU]);

    expect(service.isExpanded('g:struktur')).toBe(true);
    expect(service.selectedKey()).toBe('c:1');
  });
});
