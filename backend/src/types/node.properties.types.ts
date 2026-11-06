import type { PropertyDataType } from "../models/property/propertyDefinition";

/** Tabs of the node form, in display order. Must match ck_property_definitions_tab (migration 011). */
export const TAB_LABELS = {
  allmant: "Allmänt",
  handlingsslag: "Handlingsslag",
  handlingstyper: "Handlingstyper",
  aktiviteter: "Aktiviteter",
  diagram: "Diagram",
  beskrivning: "Beskrivning",
  referenser: "Referenser",
} as const;

export type TabKey = keyof typeof TAB_LABELS;
export const TAB_ORDER = Object.keys(TAB_LABELS) as TabKey[];

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
  tabKey: TabKey;
  label: string;
  fields: FormField[];
}

export interface NodeForm {
  nodeId: number;
  nodeTypeCode: string;
  tabs: FormTab[];
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
