import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { PropertyDefinition } from "../models/property/propertyDefinition";
import type { PropertyOption } from "../models/property/propertyOption";

export class PropertyDefinitionRepository extends CrudRepository<PropertyDefinition> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "property_definitions", trx);
  }

  async findByIds(ids: number[]): Promise<PropertyDefinition[]> {
    if (ids.length === 0) return [];
    return this.qb.whereIn("id", ids);
  }

  /** The active fields of one node type, in display order. */
  async findActiveByNodeType(nodeTypeId: number): Promise<PropertyDefinition[]> {
    return this.qb
      .where({ nodeTypeId, isActive: true })
      .orderBy("sortOrder", "asc")
      .orderBy("id", "asc");
  }

  /** The active choices of the given enum fields. */
  async findActiveOptions(definitionIds: number[]): Promise<PropertyOption[]> {
    if (definitionIds.length === 0) return [];
    const db = this.trx ?? this.knex;
    return db("property_options")
      .whereIn("propertyDefinitionId", definitionIds)
      .where({ isActive: true })
      .orderBy("sortOrder", "asc");
  }
}
