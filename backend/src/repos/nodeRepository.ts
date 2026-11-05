import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Node } from "../models/node/node";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";

export class NodeRepository extends CrudRepository<Node> {
  constructor(knex: Knex) {
    super(knex, "nodes");
  }

  /** All nodes of one structure, in sibling order. */
  async findByStructure(structureId: number): Promise<Node[]> {
    return this.qb
      .where({ structureId })
      .orderBy([{ column: "parentId" }, { column: "sortOrder" }, { column: "id" }]);
  }

  /** All property values of one structure in a single query (a join, so no huge IN list on MSSQL). */
  async findValuesByStructure(structureId: number): Promise<NodePropertyValues[]> {
    return this.knex("node_property_values as v")
      .join("nodes as n", "n.id", "v.node_id")
      .where("n.structure_id", structureId)
      .select("v.*");
  }
}
