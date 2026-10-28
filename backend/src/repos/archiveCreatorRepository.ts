
import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import { ArchiveCreator } from "../models/archive/archiveCreator";

export class ArchiveCreatorRepository
  extends CrudRepository<ArchiveCreator> {

  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "archive_creators", trx);
  }

  async findById(id: number): Promise<ArchiveCreator | undefined> {
    return this.qb.where({ id }).first();
  }
}
