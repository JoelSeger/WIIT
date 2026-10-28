import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { NodeType } from "../models/node/nodeType";

export class NodeTypeRepository extends CrudRepository<NodeType> {
  constructor(knex: Knex) {
    super(knex, "node_types");
  }

  async findByIds(ids: number[]): Promise<NodeType[]> {
    if (ids.length === 0) return [];
    return this.qb.whereIn("id", ids);
  }
}
