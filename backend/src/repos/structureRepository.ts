import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Structure } from "../models/structure/structure";

export class StructureRepository extends CrudRepository<Structure> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "structures", trx);
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
}