import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { PropertyDefinition } from "../models/property/propertyDefinition";

export class PropertyDefinitionRepository extends CrudRepository<PropertyDefinition> {
  constructor(knex: Knex) {
    super(knex, "property_definitions");
  }

  async findByIds(ids: number[]): Promise<PropertyDefinition[]> {
    if (ids.length === 0) return [];
    return this.qb.whereIn("id", ids);
  }
}
