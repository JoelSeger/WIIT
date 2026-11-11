import type { ArchiveCreatorSummary } from '../models/archive-creator.model';
import type { StructureSummary } from '../models/structure.model';
import type { NodeValue, PropertyDataType, TreeNode } from '../models/tree-node.model';

/**
 * Test data for the tree view specs, typed with the same interfaces as the app (code guidelines 5.9).
 * Shape follows the demo seed: Informationshanteringsplan and Förvaringsenheter.
 */

export function makeNode(overrides: Partial<TreeNode> & Pick<TreeNode, 'id' | 'title'>): TreeNode {
  return {
    structureId: 1,
    parentId: null,
    nodeTypeId: 1,
    referenceCode: null,
    previousReferenceCode: null,
    sortOrder: 0,
    isPublished: true,
    externalId: null,
    validFrom: null,
    validTo: null,
    description: null,
    portalUrl: null,
    sourceUpdatedAt: null,
    sourceUpdatedBy: null,
    nodeType: {
      id: 1,
      code: 'process',
      name: 'Process',
      structureType: 'klassificering',
      eadLevel: 'otherlevel',
      eadOtherlevel: 'structuralunit',
      eadUnitDescription: 'Process',
    },
    values: [],
    children: [],
    ...overrides,
  };
}

let nextValueId = 1;

export function makeValue(
  definition: { id: number; label: string; dataType: PropertyDataType },
  value: Partial<NodeValue>,
): NodeValue {
  return {
    id: nextValueId++,
    nodeId: 1,
    propertyDefinitionId: definition.id,
    valueBoolean: null,
    valueOrder: 0,
    definition: {
      id: definition.id,
      nodeTypeId: 1,
      key: definition.label.toLowerCase(),
      label: definition.label,
      dataType: definition.dataType,
      isPublic: true,
      helpText: null,
      sortOrder: definition.id,
      isRepeatable: false,
    },
    ...value,
  };
}

export const IHP: StructureSummary = {
  id: 1,
  code: 'ihp',
  name: 'Informationshanteringsplan',
  structureType: 'klassificering',
  isPublished: true,
  version: '2',
};

export const FORVARING: StructureSummary = {
  id: 2,
  code: 'forvaring',
  name: 'Förvaringsenheter',
  structureType: 'forvaring',
  isPublished: true,
  version: null,
};

/** 4 Bedriva forskning / 4.2 / 4.2.1 */
export function ihpTree(): TreeNode[] {
  const process421 = makeNode({
    id: 12,
    parentId: 11,
    referenceCode: '4.2.1',
    title: 'Förbereda forskning och söka extern finansiering',
  });
  const group42 = makeNode({
    id: 11,
    parentId: 10,
    referenceCode: '4.2',
    title: 'Förbereda forskning',
    children: [process421],
  });
  return [
    makeNode({ id: 10, referenceCode: '4', title: 'Bedriva forskning', children: [group42] }),
  ];
}

/** Owns the IHP (1) and Förvaringsenheter (2) through MAU-001, as in the demo seed. */
export const MAU: ArchiveCreatorSummary = {
  id: 1,
  parentId: null,
  name: 'Malmö universitet',
  startYear: null,
  endYear: null,
  isPublished: true,
  structureIds: [1, 2],
  archives: [{ id: 1, referenceCode: 'MAU-001', name: 'Malmö universitets arkiv' }],
};

/** No structures yet (GV/LS are imported later). */
export const MAH: ArchiveCreatorSummary = {
  id: 2,
  parentId: null,
  name: 'Malmö högskola 1998–2015',
  startYear: 1998,
  endYear: 2015,
  isPublished: true,
  structureIds: [],
  archives: [],
};
