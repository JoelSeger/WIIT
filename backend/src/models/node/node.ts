export interface Node {
  id: number;
  structureId: number;
  parentId: number;
  nodeTypeId: number;
  referenceCode: string;
  title: string;
  sortOrder: number;
  isPublished: boolean | null;
  externalId?: string;
  rowVersion?: Buffer;
  createdAt?: Date;
  createdBy?: number;
  updatedAt?: Date;
  updatedBy?: number;
  validFrom?: Date;
  validTo?: Date;
  description?: string;
  portalUrl?: string;
  previousReferenceCode?: string;
}
