import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { FieldDefinition, PropertyDefinition } from "../models/property/propertyDefinition";
import type { PropertyOption } from "../models/property/propertyOption";
import type { PropertyTab } from "../models/property/propertyTab";

/**
 * The field setup: fields (property_definitions), where each node type has them
 * (node_type_properties), their choices (property_options) and the tabs (property_tabs).
 */
export class PropertyDefinitionRepository extends CrudRepository<FieldDefinition> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "property_definitions", trx);
  }

  private get db(): Knex | Knex.Transaction {
    return this.trx ?? this.knex;
  }

  async findByIds(ids: number[]): Promise<FieldDefinition[]> {
    if (ids.length === 0) return [];
    return this.qb.whereIn("id", ids);
  }

  /**
   * Fields joined with their placement on a node type (migration 013). The label is the one
   * for that node type: label_override if set, otherwise the field's own.
   */
  private placed(): Knex.QueryBuilder {
    return this.db("property_definitions as d")
      .join("node_type_properties as l", "l.property_definition_id", "d.id")
      .select(
        "d.id", "d.key",
        this.db.raw("COALESCE(l.label_override, d.label) AS label"),
        "d.data_type", "d.is_public", "d.ead_element", "d.help_text",
        "d.is_active", "d.is_repeatable", "d.has_own_published",
        "l.node_type_id", "l.tab_key", "l.group_key", "l.sort_order", "l.is_required",
      );
  }

  /** The active fields of one node type, in display order. */
  async findActiveByNodeType(nodeTypeId: number): Promise<PropertyDefinition[]> {
    return this.placed()
      .where("l.node_type_id", nodeTypeId)
      .where("d.is_active", true)
      .orderBy("l.sort_order", "asc")
      .orderBy("d.id", "asc");
  }

  /**
   * The fields of several node types, retired ones included (a tree still shows values that
   * were registered in a field that is no longer used). One row per node type and field.
   */
  async findPlacedByNodeTypes(nodeTypeIds: number[]): Promise<PropertyDefinition[]> {
    if (nodeTypeIds.length === 0) return [];
    return this.placed()
      .whereIn("l.node_type_id", nodeTypeIds)
      .orderBy("l.node_type_id", "asc")
      .orderBy("l.sort_order", "asc")
      .orderBy("d.id", "asc");
  }

  /** The active choices of the given enum fields. */
  async findActiveOptions(definitionIds: number[]): Promise<PropertyOption[]> {
    if (definitionIds.length === 0) return [];
    return this.db("property_options")
      .whereIn("propertyDefinitionId", definitionIds)
      .where({ isActive: true })
      .orderBy("sortOrder", "asc");
  }

  /** The tabs in display order (migration 013). Retired tabs are left out. */
  async findActiveTabs(): Promise<PropertyTab[]> {
    return this.db("property_tabs")
      .where({ isActive: true })
      .orderBy("sortOrder", "asc")
      .orderBy("key", "asc");
  }
}
