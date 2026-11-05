export interface PropertyDefinition {
  id: number;
  nodeTypeId: number;
  key: string;
  label: string;
  dataType: 'text' | 'longtext' | 'number' | 'date' | 'boolean' | 'url' | 'enum';
  isRequired: boolean | null;
  isPublic: boolean | null;
  eadElement: string | null;
  helpText: string | null;
  sortOrder: number;
  isActive: boolean | null;
  isRepeatable: boolean | null;
}
