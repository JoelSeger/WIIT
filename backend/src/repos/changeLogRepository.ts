import { Knex } from "knex";
import { ChangeLog } from "../models/changeLog";
import { CrudRepository } from "./crudRepository";


export class ChangeLogRepository extends CrudRepository<ChangeLog>{
    constructor(protected readonly db: Knex, trx?: Knex.Transaction) {
    super(db, "change_log", trx);
}

  async record(entry: Partial<ChangeLog>): Promise<void> {
    await this.qb
      .insert({
        ...entry
      })
  }
}
