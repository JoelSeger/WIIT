
import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import { Archive } from "../models/archive/archive";

export class ArchiveRepository extends CrudRepository<Archive> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "archives", trx);
  }

  async findById(id: number): Promise<Archive | undefined> {
    return this.qb.where({ id }).first();
  }
}
