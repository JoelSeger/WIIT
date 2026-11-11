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

/** An archive in the short form, e.g. for choosing where an import goes (archiveId). */
export interface ArchiveSummary {
  id: number;
  referenceCode: string | null;
  name: string;
}

/**
 * Short form for menus and the tree view (GET /api/archive-creators).
 * structureIds are the structures the creator's archives use (archives + archive_structures).
 */
export interface ArchiveCreatorSummary {
  id: number;
  parentId: number | null;
  name: string;
  startYear: number | null;
  endYear: number | null;
  isPublished: boolean | null;
  structureIds: number[];
  archives: ArchiveSummary[];
}
