import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { NodeRelation } from "../models/node/nodeRelation";

export class NodeRelationRepository extends CrudRepository<NodeRelation> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "node_relations", trx);
  }

  /**
   * Removes every relation the node takes part in (as source or as target) and returns them.
   * The foreign keys are NO ACTION (migration 004), so this must run before the node is deleted.
   */
  async deleteByNodeId(nodeId: number): Promise<NodeRelation[]> {
    const rows: NodeRelation[] = await this.qb
      .where("from_node_id", nodeId)
      .orWhere("to_node_id", nodeId)
      .select();
    if (rows.length > 0) {
      await this.qb.whereIn("id", rows.map((r) => r.id)).del();
    }
    return rows;
  }
}