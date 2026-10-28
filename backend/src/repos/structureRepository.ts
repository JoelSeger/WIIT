
import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import { Structure } from "../models/structure/structure";

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
}
