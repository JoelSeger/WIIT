export interface ArchiveCreator {
  id: number;
  parentId?: number | null;
  creatorType: string;
  name: string;
  startYear?: number;
  endYear?: number;
  description?: string;
  externalId?: string;
  isPublished: boolean | null;
  createdAt?: Date;
  createdBy?: number;
  updatedAt?: Date;
  updatedBy?: number;
}
