import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Structure } from "../models/structure/structure";
import type { StructureAttributeChanges } from "../types/structureEdit.types";

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
  async findByExternalId(externalId: string): Promise<Structure | undefined> {
    return this.qb.where({ externalId }).first();
  }

  /**
   * F1.1.2: updates the editable columns of one structure and stamps updated_at / updated_by.
   * Returns false when no row was updated. Call inside a transaction.
   */
  async updateAttributes(
    id: number,
    changes: StructureAttributeChanges,
    updatedBy: number | null,
  ): Promise<boolean> {
    const count = await this.qb.where({ id }).update({ ...changes, updatedAt: new Date(), updatedBy });
    return Number(count) > 0;
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