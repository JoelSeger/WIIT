import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { ChangeLog } from "../models/changeLog";

/** change_log is append-only (migration 005): this repository only adds rows. */
export class ChangeLogRepository extends CrudRepository<ChangeLog> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "change_log", trx);
  }

  async logNodeUpdate(entry: {
    nodeId: number;
    structureId: number;
    oldValue: unknown;
    newValue: unknown;
    changedBy: number | null;
  }): Promise<void> {
    await this.qb.insert({
      entityType: "node",
      entityId: entry.nodeId,
      structureId: entry.structureId,
      action: "update",
      oldValue: JSON.stringify(entry.oldValue),
      newValue: JSON.stringify(entry.newValue),
      comment: null,
      changedBy: entry.changedBy,
      changedAt: new Date(),
    });
  }
  /** The deleted node is kept in old_value, because the row itself is gone afterwards. */
  async logNodeDelete(entry: {
    nodeId: number;
    structureId: number;
    oldValue: unknown;
    changedBy: number | null;
  }): Promise<void> {
    await this.qb.insert({
      entityType: "node",
      entityId: entry.nodeId,
      structureId: entry.structureId,
      action: "delete",
      oldValue: JSON.stringify(entry.oldValue),
      newValue: null,
      comment: null,
      changedBy: entry.changedBy,
      changedAt: new Date(),
    });
  }
}
