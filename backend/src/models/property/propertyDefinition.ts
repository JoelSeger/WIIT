export type PropertyDataType = "text" | "longtext" | "number" | "date" | "boolean" | "url" | "enum";

export interface PropertyDefinition {
  id: number;
  nodeTypeId: number;
  key: string;
  label: string;
  dataType: PropertyDataType;
  isRequired: boolean | null;
  isPublic: boolean | null;
  eadElement: string | null;
  helpText: string | null;
  sortOrder: number;
  isActive: boolean | null;
  isRepeatable: boolean | null;
  /** Tab the field is shown in (migration 011). */
  tabKey: string | null;
  /** Fields with the same groupKey are the columns of one table (migration 011). */
  groupKey: string | null;
  /** Row "Värde | Eget (checkbox) | Publicerad (text box)" (migration 011). */
  hasOwnPublished: boolean | null;
}
