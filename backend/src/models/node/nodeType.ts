export interface NodeType {
  id: number;
  code: string;
  name: string;
  structureType: string;
  eadLevel: string;
  eadOtherlevel?: string;
  description?: string;
  isActive: boolean | null;
}
