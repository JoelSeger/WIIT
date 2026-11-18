import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { ChangeLog } from "../models/changeLog";

/** change_log is append-only (migration 005): this repository only adds rows. */
export class ChangeLogRepository extends CrudRepository<ChangeLog> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "change_log", trx);
  }

    async record(entry: Partial<ChangeLog>): Promise<void> {
        await this.qb
            .insert({
                ...entry
            });
    }
}
