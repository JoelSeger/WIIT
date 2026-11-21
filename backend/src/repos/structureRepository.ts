import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Structure } from "../models/structure/structure";

export class StructureRepository extends CrudRepository<Structure> {
  constructor(knex: Knex) {
    super(knex, "structures");
  }

  async findById(id: number): Promise<Structure | undefined> {
    return this.qb.where({ id }).first();
  }

  async findByCode(code: string): Promise<Structure | undefined> {
    return this.qb.where({ code }).first();
  }
  /** Short list for menus: no description or metadata, sorted by name. */
  async findSummaries(structureType?: string, publicOnly = false): Promise<Array<Pick<Structure,
    "id" | "code" | "name" | "structureType" | "isPublished" | "version">>> {
    const q = this.qb
      .select("id", "code", "name", "structureType", "isPublished", "version")
      .orderBy("name");
    if (structureType) q.where({ structureType });
    if (publicOnly) q.where({ isPublished: true });
    return q;
  }

  async flipPublished(id: number): Promise<Structure> {
    const structure = await this.qb
      .where("id", id)
      .select()
      .first();

    if (!structure) throw new Error(`Structure with id: ${id} was not found`);

    const nextStatus = !structure.isPublished;
    structure.isPublished = nextStatus;

    await this.qb
      .where("id", id)
      .update({ isPublished: nextStatus });

    return structure;
  }
}
