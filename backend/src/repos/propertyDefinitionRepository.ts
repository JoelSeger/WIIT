import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { PropertyDefinition } from "../models/property/propertyDefinition";

export class PropertyDefinitionRepository extends CrudRepository<PropertyDefinition> {
  constructor(protected readonly db: Knex) {
    super(db, "property_definitions");
  }

  async findByIds(ids: number[]): Promise<PropertyDefinition[]> {
    if (ids.length === 0) return [];
    return this.q().whereIn("id", ids);
  }
}
