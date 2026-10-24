export interface RelationType {
  id: number;
  code: string;
  name: string;
  inverseName: string | null;
  eadElement: string | null;
  isActive: boolean | null;
}
