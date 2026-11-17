export interface NodeType {
  id: number;
  code: string;
  name: string;
  structureType: string;
  eadLevel: string;
  eadOtherlevel: string | null;
  eadUnitDescription: string | null;
  description: string | null;
  isActive: boolean | null;
  /** May be created without a parent, as the top node of a structure (migration 012). Boolean is for MSSQL and number for SQLite */
  canBeRoot: boolean | number;
  /** Nodes of this type have the Aktiviteter tab (migration 012). */
  hasActivities: boolean | number;
}
