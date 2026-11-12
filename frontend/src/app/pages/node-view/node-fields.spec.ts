import { makeNode, makeValue } from '../../testing/tree-fixtures';
import { formatValidity, formatValue, groupChildrenByType, toNodeFields } from './node-fields';

const BEVARAS = { id: 1, label: 'Bevaras / gallras', dataType: 'enum' as const };
const DIARIEFORS = { id: 2, label: 'Diarieförs', dataType: 'boolean' as const };
const PLACERING = { id: 3, label: 'Placering', dataType: 'text' as const };

describe('node-fields', () => {
  it('F3.6 groups repeated values of one field under one label', () => {
    const fields = toNodeFields([
      makeValue(BEVARAS, { valueText: 'Bevaras' }),
      makeValue(PLACERING, { valueText: 'Niagara', valueOrder: 0 }),
      makeValue(PLACERING, { valueText: 'Ork VII', valueOrder: 1 }),
    ]);

    expect(fields.map((field) => [field.label, field.values])).toEqual([
      ['Bevaras / gallras', ['Bevaras']],
      ['Placering', ['Niagara', 'Ork VII']],
    ]);
  });

  it('F3.6 leaves out empty values', () => {
    const fields = toNodeFields([makeValue(PLACERING, { valueText: '   ' })]);

    expect(fields).toEqual([]);
  });

  it('F3.6 shows Ja / Nej for boolean fields', () => {
    expect(formatValue(makeValue(DIARIEFORS, { valueBoolean: true }))).toBe('Ja');
    expect(formatValue(makeValue(DIARIEFORS, { valueBoolean: false }))).toBe('Nej');
    expect(formatValue(makeValue(DIARIEFORS, { valueBoolean: null }))).toBeNull();
  });

  it('F8.1 shows the validity period', () => {
    expect(formatValidity('2016-01-01T00:00:00.000Z', '2023-12-31T00:00:00.000Z')).toBe(
      '2016-01-01 – 2023-12-31',
    );
    expect(formatValidity('2024-01-01', null)).toBe('från 2024-01-01');
    expect(formatValidity(null, null)).toBeNull();
  });

  it('groups children by node type and keeps their order', () => {
    const svit = { id: 2, code: 'svit', name: 'Svit' };
    const box = { id: 3, code: 'arkivbox', name: 'Arkivbox' };
    const base = makeNode({ id: 1, title: 'x' }).nodeType;
    const children = [
      makeNode({ id: 1, title: 'Svit 1', nodeType: { ...base, ...svit } }),
      makeNode({ id: 2, title: 'Box 1', nodeType: { ...base, ...box } }),
      makeNode({ id: 3, title: 'Svit 2', nodeType: { ...base, ...svit } }),
    ];

    const groups = groupChildrenByType(children);

    expect(groups.map((g) => [g.typeName, g.nodes.map((n) => n.title)])).toEqual([
      ['Svit', ['Svit 1', 'Svit 2']],
      ['Arkivbox', ['Box 1']],
    ]);
  });
});
