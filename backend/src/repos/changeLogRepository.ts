import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { ChangeLog } from "../models/changeLog";

/** change_log is append-only (migration 005): this repository only adds rows. */
export class ChangeLogRepository extends CrudRepository<ChangeLog> {
  constructor(knex: Knex) {
    super(knex, "change_log");
  }

  //ID and changedAt should be handled by the database not the program.
    async record(entry: Omit<ChangeLog, "id" | "changedAt">): Promise<void> {
        await this.qb()
            .insert({
                ...entry
            });
    }
}
