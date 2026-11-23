export interface Archive {
  id: number;
  archiveCreatorId: number;
  referenceCode?: string;
  name: string;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
  externalId?: string | null;
  isPublished: boolean | null;
  createdAt: Date;
  createdBy: number | null;
  updatedAt: Date;
  updatedBy: number | null;
}
