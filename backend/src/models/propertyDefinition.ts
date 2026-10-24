export interface PropertyDefinition {
  id: number;
  nodeTypeId: number;
  key: string;
  label: string;
  dataType: string;
  isRequired: boolean | null;
  isPublic: boolean | null;
  eadElement: string;
  helpText: string;
  sortOrder: number;
  isActive: boolean | null;
}
