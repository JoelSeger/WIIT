import { Knex } from "knex";
import { NodePropertyValues } from "../../models/node/nodePropertyValues";
import { CrudRepository } from "../crudRepository";

export class NodePropertyValuesRepository extends CrudRepository<NodePropertyValues> {
  constructor(db: Knex) {
    super(db, "node_property_values");
  }

  async findByNodeIds(nodeIds: number[]): Promise<NodePropertyValues[]> {
    return this.q()
      .whereIn("node_id", nodeIds);
  }
}
