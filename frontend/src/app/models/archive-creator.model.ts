/**
 * Data sent by GET /api/archive-creators (backend: routers/archiveCreatorRoutes.ts).
 * Keep in sync with ArchiveCreatorSummary in backend/src/models/archive/archiveCreator.ts.
 */
/** An archive of a creator; its id is what the EAD import takes as archiveId. */
export interface ArchiveSummary {
  id: number;
  referenceCode: string | null;
  name: string;
}

export interface ArchiveCreatorSummary {
  id: number;
  /** Set when the creator sits under another creator, e.g. a faculty under the university. */
  parentId: number | null;
  name: string;
  startYear: number | null;
  endYear: number | null;
  isPublished: boolean | null;
  /** Structures the creator's archives use (archives + archive_structures). */
  structureIds: number[];
  /** The creator's archives (an import can be linked to one of them). */
  archives: ArchiveSummary[];
}
