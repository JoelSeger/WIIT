export interface NodeRelation {
  id: number;
<<<<<<< Updated upstream
  realtionTypeId: number;
  fromNodeId: number;
  toNodeId: number;
  validFrom: Date;
  validTo: Date;
  note: string;
  createdAt?: Date;
  createdBy?: number;
=======
  relationTypeId: number;              // was realtionTypeId
  fromNodeId: number;
  toNodeId: number;
  validFrom: Date | null;
  validTo: Date | null;
  note: string | null;
  createdAt?: Date;
  createdBy?: number | null;
>>>>>>> Stashed changes
}
