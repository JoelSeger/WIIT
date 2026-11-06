import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { NodeActivity } from "../models/node/nodeActivity";

export class NodeActivityRepository extends CrudRepository<NodeActivity> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "node_activities", trx);
  }

  async findByNodeId(nodeId: number): Promise<NodeActivity[]> {
    return this.qb.where({ nodeId }).orderBy("sortOrder", "asc").orderBy("id", "asc");
  }

  /** activityId → the handlingstyp nodes ticked in its checklist */
  async findHandlingstypIds(activityIds: number[]): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
    if (activityIds.length === 0) return map;
    const db = this.trx ?? this.knex;
    const rows: { activityId: number; handlingstypNodeId: number }[] = await db("node_activity_handlingstyp")
      .whereIn("activityId", activityIds)
      .select();
    for (const r of rows) {
      const list = map.get(r.activityId) ?? [];
      list.push(r.handlingstypNodeId);
      map.set(r.activityId, list);
    }
    return map;
  }

  /** Removes all activities of a node; their checklist rows go with them (ON DELETE CASCADE). */
  async deleteByNodeId(nodeId: number): Promise<void> {
    await this.qb.where({ nodeId }).del();
  }

  async addHandlingstyp(activityId: number, handlingstypNodeIds: number[]): Promise<void> {
    if (handlingstypNodeIds.length === 0) return;
    const db = this.trx ?? this.knex;
    await db("node_activity_handlingstyp").insert(
      handlingstypNodeIds.map((handlingstypNodeId) => ({ activityId, handlingstypNodeId })),
    );
  }
}
