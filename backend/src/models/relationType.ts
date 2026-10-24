export interface RelationType {
  id: number;
  code: string;
  name: string;
  inverseName: string;
  eadElement: string;
  isActive: boolean | null;
}
