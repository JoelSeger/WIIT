
import { CrudRepository } from "./crudRepository";
import { Node } from "../models/node/node";
import type { Knex } from "knex";
import {CreateNodeData} from "../types/nodeCreation.types"

export class NodeRepository extends CrudRepository<Node> {
    constructor(knex: Knex, trx?: Knex.Transaction) {
        super(knex, "nodes", trx);
    }

    async findByStructureId(
        structureId: number
    ): Promise<Node[]> {
        const rows = await this.qb
            .where({ structure_id: structureId })
            .orderBy("sort_order", "asc")
            .select();

        return rows.map((row: any) => this.mapNode(row));
    }

    async findByParentId(
        parentId: number
    ): Promise<Node[]> {
        const rows = await this.qb
            .where({ parent_id: parentId })
            .orderBy("sort_order", "asc")
            .select();

        return rows.map((row: any) => this.mapNode(row));
    }

    async findRootNodes(
        structureId: number
    ): Promise<Node[]> {
        const rows = await this.qb
            .where({
                structure_id: structureId,
                parent_id: null
            })
            .orderBy("sort_order", "asc")
            .select();

        return rows.map((row: any) => this.mapNode(row));
    }
    
    async findById(id: number): Promise<Node | undefined> {
      const row = await this.qb
        .where({ id })
        .first();

      console.log("RAW DATABASE ROW:", row);

      if (!row) {
        return undefined;
      }

    return this.mapNode(row);
    }

    async existsByStructureParentAndReferenceCode(
    structureId: number,
    parentId: number | null,
    referenceCode: string
    ): Promise<boolean> {
      const query = this.qb
          .where({
              structureId,
              referenceCode
          });

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
              title: data.title,
              sort_order: data.sortOrder ?? 0,
              is_published: false,
              description: data.description ?? null,
              created_by: data.createdBy ?? null,
              created_at: new Date()
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
        updatedBy: row.updatedBy
    };
}

}
