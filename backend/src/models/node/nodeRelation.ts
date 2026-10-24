export interface NodeRelation {
  id: number;
  relationTypeId: number;
  fromNodeId: number;
  toNodeId: number;
  validFrom: Date | null;
  validTo: Date | null;
  note: string | null;
  createdAt?: Date;
  createdBy?: number | null;
}
