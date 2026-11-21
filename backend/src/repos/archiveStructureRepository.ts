
import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";

// camelCase, like models/archive/archiveStructure.ts: knex-stringcase maps the columns.
export interface ArchiveStructure {
  id: number;
  archiveId: number;
  structureId: number;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt?: Date;
  createdBy: number | null;
}

export class ArchiveStructureRepository extends CrudRepository<ArchiveStructure> {
    constructor(knex: Knex) {
      super(knex, "archive_structures")
    }


  async create(item: Omit<ArchiveStructure, "id" | "created_at">): Promise<ArchiveStructure> {
    const [created] = await this.qb
      .insert(item)
      .returning("*");

    return created as ArchiveStructure;
  }
}
