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

  /**
   * true if the node is used by an activity as a strukturenhet or ticked as a handlingstyp.
   * Both foreign keys are NO ACTION, so such a node cannot be deleted. Call this after the
   * node's own activities have been removed, so they do not count as "other" users.
   */
  async isReferenced(nodeId: number): Promise<boolean> {
    const db = this.trx ?? this.knex;
    const asUnit = await db("node_activities").where("structure_unit_node_id", nodeId).first();
    if (asUnit) return true;
    const asType = await db("node_activity_handlingstyp").where("handlingstyp_node_id", nodeId).first();
    return asType !== undefined;
  }
}
