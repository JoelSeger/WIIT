import type { Knex } from "knex";

/**
 * F4.1 – SQL for the search. Only queries here, no rules about what may be shown
 * (that is in SearchService).
 *
 * LIKE '%…%' instead of SQL Server Full-Text Search: the data is a few thousand nodes,
 * Full-Text is not in the mssql Docker image and does not exist in SQLite (the tests).
 * If it gets slow, only this file has to change.
 *
 * Column names are snake_case here; knex-stringcase (db in config/db.ts) returns camelCase.
 */

export interface SearchFilter {
  pattern: string;         // already escaped, with % around it
  publicOnly: boolean;
  structureType?: string;
  structureId?: number;
  limit: number;           // max candidates, not the page size
}

export interface NodeHitRow {
  id: number;
  structureId: number;
  parentId: number | null;
  title: string;
  referenceCode: string | null;
  description: string | null;
  structureName: string;
  structureType: string;
  nodeTypeCode: string;
  nodeTypeName: string;
}

export interface ValueHitRow {
  nodeId: number;
  label: string;
  valueText: string;
}

export interface SkeletonRow {
  id: number;
  parentId: number | null;
  title: string;
  referenceCode: string | null;
  isPublished: boolean | number | null;   // MSSQL: boolean, SQLite: 0/1
}

const LIKE = "?? LIKE ? ESCAPE '\\'";

export class SearchRepository {
  constructor(private readonly knex: Knex) {}

  /** nodes + structures with the filters every search uses. */
  private scoped(f: SearchFilter): Knex.QueryBuilder {
    const q = this.knex("nodes as n").join("structures as s", "s.id", "n.structure_id");
    if (f.publicOnly) q.where("s.is_published", true).where("n.is_published", true);
    if (f.structureType) q.where("s.structure_type", f.structureType);
    if (f.structureId) q.where("s.id", f.structureId);
    return q;
  }

  /** Ids of nodes whose title, reference code or description matches. */
  async findNodeMatches(f: SearchFilter): Promise<number[]> {
    const rows: { id: number }[] = await this.scoped(f)
      .where((w) => w
        .whereRaw(LIKE, ["n.title", f.pattern])
        .orWhereRaw(LIKE, ["n.reference_code", f.pattern])
        .orWhereRaw(LIKE, ["n.description", f.pattern]))
      .select("n.id")
      .orderBy("n.id")
      .limit(f.limit);
    return rows.map((r) => r.id);
  }

  /**
   * Nodes where a property value (Sekretess, Gallring, Placering …) matches.
   * Public mode never searches non-public fields (OSL): otherwise a hit would reveal
   * that the word is in a hidden field, even if the value itself is not returned.
   */
  async findValueMatches(f: SearchFilter): Promise<ValueHitRow[]> {
    const q = this.scoped(f)
      .join("node_property_values as v", "v.node_id", "n.id")
      .join("property_definitions as d", "d.id", "v.property_definition_id")
      .whereRaw(LIKE, ["v.value_text", f.pattern])
      .select("n.id as node_id", "d.label", "v.value_text")
      .orderBy("n.id")
      .limit(f.limit);
    if (f.publicOnly) q.where("d.is_public", true);
    return q;
  }

  /** The full row of each hit, with its type and structure. ids is at most MAX_CANDIDATES (MSSQL allows ~2100 parameters). */
  async findNodesByIds(ids: number[]): Promise<NodeHitRow[]> {
    if (ids.length === 0) return [];
    return this.knex("nodes as n")
      .join("structures as s", "s.id", "n.structure_id")
      .join("node_types as t", "t.id", "n.node_type_id")
      .whereIn("n.id", ids)
      .select(
        "n.id", "n.structure_id", "n.parent_id", "n.title", "n.reference_code", "n.description",
        "s.name as structure_name", "s.structure_type",
        "t.code as node_type_code", "t.name as node_type_name",
      );
  }

  /** A light copy of the trees (id / parent / title only) to build the path up to the root. */
  async findSkeleton(structureIds: number[]): Promise<SkeletonRow[]> {
    if (structureIds.length === 0) return [];
    return this.knex("nodes")
      .whereIn("structure_id", structureIds)
      .select("id", "parent_id", "title", "reference_code", "is_published");
  }
}
