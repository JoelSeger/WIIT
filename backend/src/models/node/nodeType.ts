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
}
