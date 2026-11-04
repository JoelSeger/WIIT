import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Structure } from "../models/structure/structure";
import type { ArchiveStructure } from "../models/archive/archiveStructure";

export class StructureRepository extends CrudRepository<Structure> {
  constructor(db: Knex) {
    super(db, "structures");
  }

  async findByType(structureType: string): Promise<Structure[]> {
    return await this.q()
      .where("structure_type", structureType)
      .select("*");
  }

  async findById(id: number): Promise<Structure | undefined> {
    return super.findOne(String.apply(id));
  }

  async findLinkedToArchive(archiveId: number, structureType: string): Promise<Structure[]> {
    return this.q()
      .join('archive_structures as ast', 'ast.structure_id', 'structures.id')
      .where({ 'ast.archive_id': archiveId, 'structures.structure_type': structureType })
      .select('structures.*');
  }

  async findLinksForArchives(archiveIds: number[]): Promise<ArchiveStructure[]> {
    if (archiveIds.length === 0) return [];
    return this.db('archive_structures').whereIn('archive_id', archiveIds).select();
  }
}
