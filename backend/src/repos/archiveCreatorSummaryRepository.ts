import type { Knex } from "knex";
import type { ArchiveCreatorSummary, ArchiveSummary } from "../models/archive/archiveCreator";

type CreatorRow = Omit<ArchiveCreatorSummary, "structureIds" | "archives">;

type ArchiveRow = ArchiveSummary & { archiveCreatorId: number };

interface CreatorStructureRow {
  creatorId: number;
  structureId: number;
}

/**
 * Read-only summaries of arkivbildare for the tree view and the import page (GET /api/archive-creators).
 * Separate from the CRUD ArchiveCreatorRepository that is used when a structure is created.
 * Reads arkivbildare (migration 007). A creator is linked to a structure through
 * its archives: archive_creators -> archives -> archive_structures -> structures.
 */
export class ArchiveCreatorSummaryRepository {
  constructor(private readonly db: Knex) {}

  /**
   * All creators sorted by name, each with its archives and the ids of the structures they use.
   * publicOnly: only published creators, and only links through published archives
   * to published structures (same rule as GET /api/structures).
   */
  async findSummaries(publicOnly = false): Promise<ArchiveCreatorSummary[]> {
    const creatorsQuery = this.db<CreatorRow>("archiveCreators")
      .select("id", "parentId", "name", "startYear", "endYear", "isPublished")
      .orderBy("name");
    if (publicOnly) creatorsQuery.where({ isPublished: true });

    const linksQuery = this.db("archiveStructures as links")
      .join("archives", "archives.id", "links.archiveId")
      .join("structures", "structures.id", "links.structureId")
      .distinct("archives.archiveCreatorId as creatorId", "links.structureId as structureId")
      .orderBy("links.structureId");
    if (publicOnly) {
      linksQuery.where("archives.isPublished", true).where("structures.isPublished", true);
    }

    const archivesQuery = this.db("archives")
      .select("id", "referenceCode", "name", "archiveCreatorId")
      .orderBy("name");
    if (publicOnly) archivesQuery.where({ isPublished: true });

    const [creators, links, archives] = await Promise.all([
      creatorsQuery as Promise<CreatorRow[]>,
      linksQuery as Promise<CreatorStructureRow[]>,
      archivesQuery as Promise<ArchiveRow[]>,
    ]);

    const structureIdsByCreator = new Map<number, number[]>();
    for (const link of links) {
      const ids = structureIdsByCreator.get(link.creatorId) ?? [];
      ids.push(link.structureId);
      structureIdsByCreator.set(link.creatorId, ids);
    }
    return creators.map((creator) => ({
      ...creator,
      structureIds: structureIdsByCreator.get(creator.id) ?? [],
      archives: archives
        .filter((archive) => archive.archiveCreatorId === creator.id)
        .map(({ id, referenceCode, name }) => ({ id, referenceCode, name })),
    }));
  }
}
