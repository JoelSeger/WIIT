import type { NodeValue, PropertyDataType, TreeNode } from '../../models/tree-node.model';

/** One field on the node page, with all its values (a repeatable field can have several). */
export interface NodeField {
  definitionId: number;
  label: string;
  helpText: string | null;
  dataType: PropertyDataType;
  values: string[];
}

/** Children of one node type, shown under their own heading as cards (Figma figure 4.2). */
export interface ChildGroup {
  typeName: string;
  nodes: TreeNode[];
}

const ISO_DATE_LENGTH = 10;

/**
 * Groups a node's values by field, in the order the backend sends them (definition sortOrder).
 * Generic on purpose: the fields come from property_definitions, nothing is hard-coded here.
 */
export function toNodeFields(values: readonly NodeValue[]): NodeField[] {
  const fields = new Map<number, NodeField>();
  for (const value of values) {
    const text = formatValue(value);
    if (text === null) {
      continue;
    }
    const field = fields.get(value.propertyDefinitionId) ?? {
      definitionId: value.propertyDefinitionId,
      label: value.definition.label,
      helpText: value.definition.helpText,
      dataType: value.definition.dataType,
      values: [],
    };
    field.values.push(text);
    fields.set(value.propertyDefinitionId, field);
  }
  return [...fields.values()];
}

/** Turns one stored value into text, or null when the value is empty. */
export function formatValue(value: NodeValue): string | null {
  switch (value.definition.dataType) {
    case 'boolean':
      return value.valueBoolean === null ? null : value.valueBoolean ? 'Ja' : 'Nej';
    case 'number':
      return value.valueNumber === null || value.valueNumber === undefined
        ? null
        : String(value.valueNumber);
    case 'date':
      return value.valueDate ? value.valueDate.slice(0, ISO_DATE_LENGTH) : null;
    default:
      return value.valueText?.trim() ? value.valueText : null;
  }
}

/** Groups children by node type, keeping the order of the first child of each type. */
export function groupChildrenByType(children: readonly TreeNode[]): ChildGroup[] {
  const groups = new Map<string, ChildGroup>();
  for (const child of children) {
    const typeName = child.nodeType.name;
    const group = groups.get(typeName) ?? { typeName, nodes: [] };
    group.nodes.push(child);
    groups.set(typeName, group);
  }
  return [...groups.values()];
}

/** F8.1: "2016-01-01 – 2023-12-31", "från 2024-01-01" or null when no dates are set. */
export function formatValidity(validFrom: string | null, validTo: string | null): string | null {
  const from = validFrom?.slice(0, ISO_DATE_LENGTH);
  const to = validTo?.slice(0, ISO_DATE_LENGTH);
  if (from && to) {
    return `${from} – ${to}`;
  }
  if (from) {
    return `från ${from}`;
  }
  return to ? `till ${to}` : null;
}
