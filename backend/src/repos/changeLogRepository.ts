import { Knex } from "knex";
import { ChangeLog } from "../models/changeLog";
import { Tx } from "../db/unitOfWork";
import { CrudRepository } from "./crudRepository";

export class ChangeLogRepository extends CrudRepository<ChangeLog>{
  constructor(protected readonly db: Knex) {
    super(db, "change_log");
  }
  async record(entry: Partial<ChangeLog>, trx: Tx): Promise<void> {
    await this.q(trx)
      .insert({
        ...entry
      })
  }
}
