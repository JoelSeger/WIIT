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
