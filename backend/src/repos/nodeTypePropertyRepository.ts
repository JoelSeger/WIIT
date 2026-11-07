import type { Knex } from "knex";
import type { NodeTypeProperty } from "../models/property/nodeTypeProperty";

/**
 * node_type_properties has a composite key (node_type_id, property_definition_id) and no id
 * column, so it does not extend CrudRepository (whose findOne / update / delete use id).
 */
export class NodeTypePropertyRepository {
  constructor(private readonly knex: Knex) {}

  /** The links of the given node types: which fields they have and in what order. */
  async findByNodeTypes(nodeTypeIds: number[]): Promise<NodeTypeProperty[]> {
    if (nodeTypeIds.length === 0) return [];
    return this.knex("node_type_properties")
      .whereIn("nodeTypeId", nodeTypeIds)
      .orderBy([{ column: "nodeTypeId" }, { column: "sortOrder" }]);
  }
}
