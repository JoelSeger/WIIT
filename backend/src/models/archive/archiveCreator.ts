export interface ArchiveCreator {
  id: number;
  parentId?: number | null;
  creatorType: string;
  name: string;
  startYear?: number | null;
  endYear?: number |null;
  description?: string | null;
  externalId?: string |null;
  isPublished: boolean | null;
  createdAt?: Date;
  createdBy?: number | null;
  updatedAt?: Date;
  updatedBy?: number | null;
}
