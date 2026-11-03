export interface Node {
  id: number;
  structureId: number;
  parentId: number | null;
  nodeTypeId: number;
  referenceCode: string | null;
  previousReferenceCode: string | null;
  title: string;
  sortOrder: number;
  isPublished: boolean | null;
  externalId: string | null;
  rowVersion?: Buffer;
  validFrom: Date | null;
  validTo: Date | null;
  description: string | null;
  portalUrl: string | null;
  sourceUpdatedAt: Date | null;
  sourceUpdatedBy: string | null;
  createdAt?: Date;
  createdBy?: number | null;
  updatedAt?: Date;
  updatedBy?: number | null;
}
