export interface NodeActivity {
  id: number;
  nodeId: number;
  name: string;
  description: string | null;
  /** Hänvisning till strukturenhet: a node of type 'strukturenhet'. */
  structureUnitNodeId: number | null;
  /** The text box beside the strukturenhet reference. */
  structureUnitText: string | null;
  sortOrder: number;
}

export interface NodeActivityHandlingstyp {
  activityId: number;
  handlingstypNodeId: number;
}
