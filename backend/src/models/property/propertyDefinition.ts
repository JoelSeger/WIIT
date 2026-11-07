/**
 * A field in the shared list (Klara's Beskrivningsfält).
 * Which node types have the field, in what order, is in NodeTypeProperty (migration 011).
 */
export interface PropertyDefinition {
  id: number;
  key: string;
  label: string;
  dataType: 'text' | 'longtext' | 'number' | 'date' | 'boolean' | 'url' | 'enum';
  isPublic: boolean | null;
  eadElement: string | null;
  helpText: string | null;
  isActive: boolean | null;
  isRepeatable: boolean | null;
  groupLabel: string | null;     // Grupperingsrubrik
  defaultValue: string | null;   // Standardvärde
  inherits: boolean | null;      // Ärver
}
