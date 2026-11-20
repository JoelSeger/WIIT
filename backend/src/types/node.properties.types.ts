import type { PropertyDataType } from "../models/property/propertyDefinition";
import type { PropertyTabKind } from "../models/property/propertyTab";

// The tabs (key, label, order) are rows in property_tabs since migration 013, not a list here.

export type PropertyScalar = string | number | boolean | null;

/** One value sent by the client. A table row = same rowIndex on every key of the group. */
export interface PropertyValueInput {
  key: string;
  value: PropertyScalar;
  rowIndex?: number;
  /** Eget checkbox. Only for fields with hasOwnPublished. */
  isOwn?: boolean | null;
  /** Publicerad text box. Only for fields with hasOwnPublished. */
  publishedText?: string | null;
}

//används för att representera värden 
export interface FormFieldValue {
  rowIndex: number;
  value: PropertyScalar;
  isOwn: boolean | null;
  publishedText: string | null;
}

export interface FormField {
  key: string;
  label: string;
  dataType: PropertyDataType;
  isRequired: boolean;
  isPublic: boolean;
  isRepeatable: boolean;
  hasOwnPublished: boolean;
  groupKey: string | null;
  helpText: string | null;
  options: string[];
  values: FormFieldValue[];
}

export interface FormTab {
  tabKey: string;
  label: string;
  /** What the tab shows (property_tabs.kind). Tabs in the form always have fields. */
  kind: PropertyTabKind;
  fields: FormField[];
}

export interface NodeForm {
  nodeId: number;
  nodeTypeCode: string;
  node: NodeHeader;
  tabs: FormTab[];
}

/** The columns of the node itself, shown on the Allmänt tab next to the property fields. */
export interface NodeHeader {
  title: string;                      // Namn
  referenceCode: string | null;       // Beteckning
  previousReferenceCode: string | null; // Tidigare beteckning
  validFrom: string | null;           // Giltig fr o m (YYYY-MM-DD)
  validTo: string | null;             // Giltig t o m
  description: string | null;         // Beskrivning
  isPublished: boolean;
  /** Version of the node row (base64). Send it back when saving to detect edits by someone else. */
  rowVersion: string | null;
  nodeTypeName: string;               // Typ (read-only, e.g. "Process")
  structureName: string;              // Klassificeringsstruktur (read-only)
}

// ---- Activities ----------------------------------------------------------------

export interface ActivityInput {
  name: string;
  description?: string | null;
  /** Checklist: handlingstyper of this process. */
  handlingstypNodeIds?: number[];
  structureUnitNodeId?: number | null;
  structureUnitText?: string | null;
}

export interface ActivityDto {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  handlingstypNodeIds: number[];
  structureUnitNodeId: number | null;
  structureUnitText: string | null;
}
