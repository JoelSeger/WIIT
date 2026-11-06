import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { NodeType } from "../models/node/nodeType";

export class NodeTypeRepository extends CrudRepository<NodeType> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "node_types", trx);
  }

  // From develop
  async findByIds(ids: number[]): Promise<NodeType[]> {
    if (ids.length === 0) return [];
    return this.qb.whereIn("id", ids);
  }

  // knex-stringcase returns camelCase column names, so the row keys are camelCase too.
  async findByCode(code: string): Promise<NodeType | undefined> {
    const row = await this.qb
      .where({ code, is_active: true })
      .first();

    if (!row) return undefined;

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      structureType: row.structureType,
      eadLevel: row.eadLevel,
      eadOtherlevel: row.eadOtherlevel,
      eadUnitDescription: row.eadUnitDescription,
      description: row.description,
      isActive: row.isActive,
    };
  }

  // From lilas's branch
  async isAllowedChild(parentTypeId: number, childTypeId: number): Promise<boolean> {
    const db = this.trx ?? this.knex;

    const rule = await db("node_type_rules")
      .where({
        parent_type_id: parentTypeId,
        child_type_id: childTypeId,
      })
      .first();

    return rule !== undefined;
  }
}