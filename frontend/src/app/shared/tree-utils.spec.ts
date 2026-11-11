import { ihpTree } from '../testing/tree-fixtures';
import { countNodes, findNodePath, nodeLabel, versionLabel } from './tree-utils';

describe('tree-utils', () => {
  it('F4.2 finds the path to a node, root first', () => {
    const path = findNodePath(ihpTree(), 12);

    expect(path?.map((node) => node.referenceCode)).toEqual(['4', '4.2', '4.2.1']);
  });

  it('F4.2 returns null for a node that is not in the tree', () => {
    expect(findNodePath(ihpTree(), 999)).toBeNull();
  });

  it('F3.6 shows the reference code before the title when there is one', () => {
    expect(nodeLabel({ referenceCode: '4.2', title: 'Förbereda forskning' })).toBe(
      '4.2 - Förbereda forskning',
    );
    expect(nodeLabel({ referenceCode: null, title: 'Verksamhetssystem' })).toBe(
      'Verksamhetssystem',
    );
  });

  it('counts all nodes, children included', () => {
    expect(countNodes(ihpTree())).toBe(3);
  });

  it('writes "version" only in front of a bare number', () => {
    expect(versionLabel('2')).toBe('version 2');
    expect(versionLabel('Version 2')).toBe('Version 2');
    expect(versionLabel(null)).toBeNull();
  });
});
