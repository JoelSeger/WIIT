import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Node } from "../models/node/node";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";
import type { CreateNodeData } from "../types/nodeCreation.types";
import type { NodeAttributeChanges } from "../types/nodeEdit.types";
import {NotFoundError} from "../services/errorService";

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

  /**
   * Which of `nodeIds` lie somewhere below `ancestorId` (child, grandchild, any depth).
   *
   * Walks up the parent_id chain of all nodes at the same time: one query per level of the
   * tree, not one per node. Plain WHERE IN queries, so it is the same SQL on SQL Server and
   * SQLite (a recursive CTE is written differently on the two).
   *
   * The node itself does not count as its own descendant.
   * Also what moving a node (F3.5) needs for F6.1.1: the new parent must not be in this set.
   */
  async filterDescendantsOf(ancestorId: number, nodeIds: number[]): Promise<Set<number>> {
    const db = this.trx ?? this.knex;
    const found = new Set<number>();
    // nodeId -> the ancestor of it we have climbed to so far (starts at the node itself)
    let climbing = new Map<number, number>([...new Set(nodeIds)].map((id) => [id, id]));

    // A tree deeper than 100 does not exist, at least in our app; the limit only stops a loop in broken data.
    for (let level = 0; level < 100 && climbing.size > 0; level++) {
      const current = [...new Set(climbing.values())];
      const parentOf = new Map<number, number | null>();
      for (let i = 0; i < current.length; i += 500) {   // MSSQL allows at most 2100 parameters
        const rows: { id: number; parent: number | null }[] = await db("nodes")
          .whereIn("id", current.slice(i, i + 500))
          .select({ id: "id", parent: "parent_id" });
        for (const r of rows) parentOf.set(r.id, r.parent);
      }

      const next = new Map<number, number>();
      for (const [nodeId, at] of climbing) {
        const parent = parentOf.get(at);
        if (parent === ancestorId) found.add(nodeId);
        else if (parent != null) next.set(nodeId, parent);
      }
      climbing = next;
    }
    return found;
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

  /** true if at least one node has this node as its parent (F3.1: only leaf nodes can be deleted). */
  async hasChildren(id: number): Promise<boolean> {
    const row = await this.qb.where({ parentId: id }).first();
    return row !== undefined;
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

  /**
   * Reference codes are unique per structure (uq_nodes_structure_reference_code), so an edit is
   * checked against the whole structure – not only against the siblings – and the node itself
   * is left out of the check.
   */
  async existsReferenceCodeInStructure(
    structureId: number,
    referenceCode: string,
    excludeNodeId: number,
  ): Promise<boolean> {
    const row = await this.qb
      .where({ structureId, referenceCode })
      .whereNot({ id: excludeNodeId })
      .first();
    return row !== undefined;
  }

  /**
   * Updates the editable columns of one node and stamps updated_at / updated_by.
   * With expectedRowVersion the update only goes through if nobody changed the row in the
   * meantime (optimistic locking, nodes.row_version). Returns false when no row was updated.
   * Call inside a transaction.
   */
  async updateAttributes(
    id: number,
    changes: NodeAttributeChanges,
    updatedBy: number | null,
    expectedRowVersion?: Buffer | null,
  ): Promise<boolean> {
    const query = this.qb.where({ id });
    if (expectedRowVersion) query.andWhere({ rowVersion: expectedRowVersion });

    const count = await query.update({
      ...changes,
      updatedAt: new Date(),
      updatedBy,
    });
    return Number(count) > 0;
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

  async flipPublished(nodeId: number): Promise<Node> {
      const node = await this.qb.where("id", nodeId).select().first();

      if (!node) {
        throw new NotFoundError(`Node ${nodeId} was not found`);
      }

      const nextStatus = !node.isPublished;
      node.isPublished = nextStatus;

      await this.qb.where("id", nodeId).update({ isPublished: nextStatus });
      return node;
  }

  async flipPublishedByStructure(structureId: number, nextStatus: boolean): Promise<Node[]> {

    await this.qb.where({ structureId: structureId }).update({ isPublished: nextStatus });

    const nodes = await this.qb.where({ structureId: structureId }).select();

    if (!nodes || nodes.length == 0) {
      return [];
    }

    return nodes
  }
}
