/** Which node types have which field (migration 011). One field can belong to several node types. */
export interface NodeTypeProperty {
  nodeTypeId: number;
  propertyDefinitionId: number;
  sortOrder: number;          // order of the fields on this node type
  isRequired: boolean | null;
}
