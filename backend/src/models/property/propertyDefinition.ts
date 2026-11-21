/** 'integer' since migration 013 (heltal). Stored in value_number like 'number'. */
export type PropertyDataType = "text" | "longtext" | "number" | "integer" | "date" | "boolean" | "url" | "enum";

/**
 * One field in the shared list (property_definitions). Since migration 013 a field has no node
 * type of its own: node_type_properties says which node types use it, and where.
 */
export interface FieldDefinition {
  id: number;
  key: string;
  label: string;
  dataType: PropertyDataType;
  isPublic: boolean | null;
  eadElement: string | null;
  helpText: string | null;
  isActive: boolean | null;
  isRepeatable: boolean | null;
  /** Row "Värde | Eget (checkbox) | Publicerad (text box)" (migration 011). */
  hasOwnPublished: boolean | null;
}

/**
 * A field as it is placed on ONE node type: the field plus its row in node_type_properties.
 * This is what the node form works with. `label` is already the label for this node type
 * (label_override if set, otherwise the field's own label).
 */
export interface PropertyDefinition extends FieldDefinition {
  nodeTypeId: number;
  /** Tab the field is shown in on this node type. */
  tabKey: string | null;
  /** Fields with the same groupKey are the columns of one table. */
  groupKey: string | null;
  sortOrder: number;
  isRequired: boolean | null;
}
