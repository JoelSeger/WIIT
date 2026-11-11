/**
 * Data sent by GET /api/node/(public/)structures/:id/tree (backend: services/nodeService.ts).
 * Keep in sync with backend/src/models/node/treeNode.ts. Dates arrive as ISO strings in JSON.
 */

export type PropertyDataType = 'text' | 'longtext' | 'number' | 'date' | 'boolean' | 'url' | 'enum';

export interface NodeType {
  id: number;
  code: string;
  name: string;
  structureType: string;
  eadLevel: string;
  eadOtherlevel: string | null;
  eadUnitDescription: string | null;
}

export interface PropertyDefinition {
  id: number;
  nodeTypeId: number;
  key: string;
  label: string;
  dataType: PropertyDataType;
  isPublic: boolean | null;
  helpText: string | null;
  sortOrder: number;
  isRepeatable: boolean | null;
}

/** One field value on a node, with the definition that says what the field is. */
export interface NodeValue {
  id: number;
  nodeId: number;
  propertyDefinitionId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: string | null;
  valueBoolean: boolean | null;
  valueOrder: number;
  definition: PropertyDefinition;
}

export interface TreeNode {
  id: number;
  structureId: number;
  parentId: number | null;
  nodeTypeId: number;
  referenceCode: string | null;
  previousReferenceCode: string | null;
  title: string;
  sortOrder: number;
  isPublished: boolean | null;
  externalId: string | null;
  validFrom: string | null;
  validTo: string | null;
  description: string | null;
  portalUrl: string | null;
  sourceUpdatedAt: string | null;
  sourceUpdatedBy: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  nodeType: NodeType;
  values: NodeValue[];
  children: TreeNode[];
}
