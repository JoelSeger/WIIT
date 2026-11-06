import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Node } from "../models/node/node";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";
import type { CreateNodeData } from "../types/nodeCreation.types";

export class NodeRepository extends CrudRepository<Node> {
  constructor(knex: Knex, trx?: Knex.Transaction) {
    super(knex, "nodes", trx);
  }

  // ---------- from develop (used by getTree) ----------

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

  // ---------- from my branch (used by createNode) ----------

  async findById(id: number): Promise<Node | undefined> {
    const row = await this.qb.where({ id }).first();
    return row ? this.mapNode(row) : undefined;
  }

  async findByStructureId(structureId: number): Promise<Node[]> {
    const rows = await this.qb
      .where({ structure_id: structureId })
      .orderBy("sort_order", "asc")
      .select();
    return rows.map((row: any) => this.mapNode(row));
  }

  async findByParentId(parentId: number): Promise<Node[]> {
    const rows = await this.qb
      .where({ parent_id: parentId })
      .orderBy("sort_order", "asc")
      .select();
    return rows.map((row: any) => this.mapNode(row));
  }

  async findRootNodes(structureId: number): Promise<Node[]> {
    const rows = await this.qb
      .where({ structure_id: structureId, parent_id: null })
      .orderBy("sort_order", "asc")
      .select();
    return rows.map((row: any) => this.mapNode(row));
  }

  async existsByStructureParentAndReferenceCode(
    structureId: number,
    parentId: number | null,
    referenceCode: string,
  ): Promise<boolean> {
    const query = this.qb.where({ structureId, referenceCode });

    if (parentId === null) {
      query.whereNull("parentId");
    } else {
      query.where({ parentId });
    }

    const row = await query.first();
    return row !== undefined;
  }

  async createNode(data: CreateNodeData): Promise<Node> {
    const [row] = await this.qb
      .insert({
        structure_id: data.structureId,
        parent_id: data.parentId,
        node_type_id: data.nodeTypeId,
        reference_code: data.referenceCode ?? null,
        previous_reference_code: data.previousReferenceCode ?? null,
        title: data.title,
        sort_order: data.sortOrder ?? 0,
        is_published: false,
        description: data.description ?? null,
        valid_from: data.validFrom ?? null,
        valid_to: data.validTo ?? null,
        created_by: data.createdBy ?? null,
        created_at: new Date(),
      })
      .returning("*");

    return this.mapNode(row);
  }

  private mapNode(row: any): Node {
    return {
      id: row.id,
      structureId: row.structureId,
      parentId: row.parentId,
      nodeTypeId: row.nodeTypeId,
      referenceCode: row.referenceCode,
      previousReferenceCode: row.previousReferenceCode,
      title: row.title,
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
      externalId: row.externalId,
      rowVersion: row.rowVersion,
      validFrom: row.validFrom,
      validTo: row.validTo,
      description: row.description,
      portalUrl: row.portalUrl,
      sourceUpdatedAt: row.sourceUpdatedAt,
      sourceUpdatedBy: row.sourceUpdatedBy,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }
}