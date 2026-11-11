import type { LoadState } from '../../core/services/structure.service';
import { TREE_GROUPS } from '../../core/services/tree-state.service';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';
import type { StructureSummary } from '../../models/structure.model';
import type { TreeNode } from '../../models/tree-node.model';
import { FORVARING, IHP, MAH, MAU, ihpTree } from '../../testing/tree-fixtures';
import { buildTreeRows } from './tree-rows';

const loadedStructures: LoadState<StructureSummary[]> = {
  status: 'loaded',
  data: [IHP, FORVARING],
};

/** No arkivbildare in the database (e.g. only an import was done). */
const noCreators: LoadState<ArchiveCreatorSummary[]> = { status: 'loaded', data: [] };

function rowsFor(
  expanded: string[],
  trees: Map<number, LoadState<TreeNode[]>> = new Map(),
  creators: LoadState<ArchiveCreatorSummary[]> = noCreators,
) {
  return buildTreeRows({
    groups: TREE_GROUPS,
    structures: loadedStructures,
    creators,
    treeState: (id) => trees.get(id) ?? { status: 'idle' },
    expanded: new Set(expanded),
  });
}

describe('buildTreeRows', () => {
  it('F4.3 shows the folders Struktur and Förvaring when everything is closed', () => {
    const rows = rowsFor([]);

    expect(rows.map((row) => row.label)).toEqual(['Struktur', 'Förvaring']);
    expect(rows.every((row) => row.level === 1 && !row.isExpanded)).toBe(true);
  });

  it('F4.3 puts each structure under the folder of its type', () => {
    const rows = rowsFor(['g:struktur', 'g:forvaring']);

    expect(rows.map((row) => row.label)).toEqual([
      'Struktur',
      'Informationshanteringsplan (version 2)',
      'Förvaring',
      'Förvaringsenheter',
    ]);
  });

  it('F4.3.1 shows children only for open rows', () => {
    const trees = new Map([[IHP.id, { status: 'loaded' as const, data: ihpTree() }]]);

    const closed = rowsFor(['g:struktur', 's:1'], trees);
    const open = rowsFor(['g:struktur', 's:1', 'n:10'], trees);

    expect(closed.map((row) => row.label)).toContain('4 - Bedriva forskning');
    expect(closed.map((row) => row.label)).not.toContain('4.2 - Förbereda forskning');
    expect(open.find((row) => row.key === 'n:11')).toMatchObject({ level: 4, parentKey: 'n:10' });
  });

  it('F4.3 shows a loading row while a structure is being fetched', () => {
    const trees = new Map([[IHP.id, { status: 'loading' as const }]]);

    const rows = rowsFor(['g:struktur', 's:1'], trees);

    expect(rows.at(-2)).toMatchObject({ kind: 'message', label: 'Laddar …', parentKey: 's:1' });
  });

  it('F4.3 shows the error message when a structure could not be fetched', () => {
    const trees = new Map([
      [IHP.id, { status: 'error' as const, message: 'Kunde inte nå servern.' }],
    ]);

    const rows = rowsFor(['g:struktur', 's:1'], trees);

    expect(
      rows.some((row) => row.kind === 'message' && row.label === 'Kunde inte nå servern.'),
    ).toBe(true);
  });

  it('F4.3 shows the arkivbildare under Struktur and their structures under them (Figma 4.1)', () => {
    const creators = { status: 'loaded' as const, data: [MAH, MAU] };

    const rows = rowsFor(['g:struktur', 'c:1'], new Map(), creators);

    expect(rows.map((row) => [row.label, row.level])).toEqual([
      ['Struktur', 1],
      ['Malmö högskola 1998–2015', 2],
      ['Malmö universitet', 2],
      ['Informationshanteringsplan (version 2)', 3],
      ['Förvaring', 1],
    ]);
    expect(rows[1]?.hasChildren).toBe(false);
  });

  it('F4.3 shows a structure without arkivbildare directly under Struktur', () => {
    const creators = { status: 'loaded' as const, data: [{ ...MAU, structureIds: [] }] };

    const rows = rowsFor(['g:struktur'], new Map(), creators);

    expect(rows.find((row) => row.key === 's:1')).toMatchObject({
      level: 2,
      parentKey: 'g:struktur',
    });
  });

  it('F4.3 still shows the structures if the arkivbildare cannot be fetched', () => {
    const creators = { status: 'error' as const, message: 'Kunde inte hämta data från servern.' };

    const rows = rowsFor(['g:struktur'], new Map(), creators);

    expect(rows.find((row) => row.key === 's:1')?.level).toBe(2);
  });

  it('F4.3 shows the Förvaring trees directly, without arkivbildare (Figma 5.2)', () => {
    const creators = { status: 'loaded' as const, data: [MAU] };

    const rows = rowsFor(['g:forvaring'], new Map(), creators);

    expect(rows.find((row) => row.key === 's:2')).toMatchObject({
      level: 2,
      parentKey: 'g:forvaring',
    });
  });

  it('F4.3 gives each row its position among its siblings (aria-posinset / aria-setsize)', () => {
    const rows = rowsFor([]);

    expect(rows.map((row) => [row.posInSet, row.setSize])).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});
