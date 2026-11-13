import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";

export class NodePropertyRepository extends CrudRepository<NodePropertyValues> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "node_property_values", trx);
  }

  async findByNodeId(nodeId: number): Promise<NodePropertyValues[]> {
    return this.qb
      .where({ nodeId })
      .orderBy("propertyDefinitionId", "asc")
      .orderBy("valueOrder", "asc");
  }

  /**
   * Replaces ALL stored values of the given fields on one node. Fields not listed are untouched,
   * so one tab can be saved at a time. Call inside a transaction.
   */
  async replaceValues(
    nodeId: number,
    definitionIds: number[],
    rows: Omit<NodePropertyValues, "id">[],
  ): Promise<void> {
    if (definitionIds.length > 0) {
      await this.qb.where({ nodeId }).whereIn("propertyDefinitionId", definitionIds).del();
    }
    if (rows.length > 0) {
      await this.qb.insert(rows);
    }
  }
}
