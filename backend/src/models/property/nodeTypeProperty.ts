/** One row in node_type_properties (migration 013): field X is used on node type Y, placed like this. */
export interface NodeTypeProperty {
  nodeTypeId: number;
  propertyDefinitionId: number;
  tabKey: string;
  groupKey: string | null;
  sortOrder: number;
  isRequired: boolean | null;
  /** Label on this node type. null = the field's own label. det är våran eget typ */
  labelOverride: string | null;
}
