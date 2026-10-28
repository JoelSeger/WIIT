import { CrudRepository } from "../repos/crudRepository";
import { Node } from "../models/node/node";
import type { Knex } from "knex";

export class NodeRepository extends CrudRepository<Node> {
  constructor(knex: Knex) {
    super(knex, "nodes");
  }

  async findByStructureId(
    structureId: number
  ): Promise<Node[]> {
    return this.qb
      .where({ structure_id: structureId })
      .orderBy("sort_order", "asc");
  }

  async findByParentId(
    parentId: number
  ): Promise<Node[]> {
    return this.qb
      .where({ parent_id: parentId })
      .orderBy("sort_order", "asc");
  }
}