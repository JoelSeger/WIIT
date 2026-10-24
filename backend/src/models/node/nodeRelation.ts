export interface NodeRelation {
  id: number;
  realtionTypeId: number;
  fromNodeId: number;
  toNodeId: number;
  validFrom: Date;
  validTo: Date;
  note: string;
  createdAt?: Date;
  createdBy?: number;
}
