import type { SearchInput, SearchMatch, SearchPathItem, SearchResponse, SearchResult } from "../models/search/search";
import type { NodeHitRow, SearchRepository, SkeletonRow, ValueHitRow } from "../repos/searchRepository";

/** Max rows each query may return. Keeps the IN list below the MSSQL parameter limit. */
export const MAX_CANDIDATES = 500;
/** Protection against broken data (a parent loop) when walking up to the root. */
const MAX_DEPTH = 50;
/** Characters on each side of the hit in a snippet. */
const SNIPPET_RADIUS = 40;

/** Ranking, higher first. */
export const RANK = {
  EXACT_REFERENCE_CODE: 100,
  EXACT_TITLE: 80,
  TITLE_STARTS_WITH: 60,
  TITLE_OR_CODE_CONTAINS: 40,
  OTHER_FIELD: 20,
} as const;

/** %, _, [ and \ are wildcards / special in LIKE (the [ only in MSSQL), so they are escaped with \. */
export const escapeLike = (s: string): string => s.replace(/[\\%_[]/g, (c) => "\\" + c);

const lower = (s: string): string => s.toLocaleLowerCase("sv");

/** Text from Klara can contain <br/>; a snippet should be one line. */
const oneLine = (s: string): string => s.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();

function snippet(text: string, q: string): string {
  const flat = oneLine(text);
  const at = lower(flat).indexOf(lower(q));
  if (at < 0) return flat.length > SNIPPET_RADIUS * 2 ? flat.slice(0, SNIPPET_RADIUS * 2) + "…" : flat;
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(flat.length, at + q.length + SNIPPET_RADIUS);
  return (start > 0 ? "…" : "") + flat.slice(start, end) + (end < flat.length ? "…" : "");
}

type Scored = SearchResult & { score: number };

export class SearchService {
  constructor(private readonly repo: SearchRepository) {}

  /**
   * F4.1: one search over all structures (klassificering(EAD3), arkivförteckning(EAD2), förvaring(Fri).
   * F4.2: each hit has its path from the root, so the frontend can open the tree at the node.
   *
   * publicOnly = true follows the same rules as NodeService.getTree(…, true):
   *   - unpublished structures and nodes are never hits
   *   - a node under an unpublished parent is not a hit (the tree hides the whole branch)
   *   - non-public fields are not searched (OSL / GDPR)
   */
  async search(input: SearchInput, publicOnly: boolean): Promise<SearchResponse> {
    const q = input.q.trim();
    const filter = {
      pattern: `%${escapeLike(q)}%`,
      publicOnly,
      structureType: input.structureType,
      structureId: input.structureId,
      limit: MAX_CANDIDATES,
    };

    const [nodeIds, valueHits] = await Promise.all([
      this.repo.findNodeMatches(filter),
      this.repo.findValueMatches(filter),
    ]);
    const truncated = nodeIds.length >= MAX_CANDIDATES || valueHits.length >= MAX_CANDIDATES;

    const valuesByNode = new Map<number, ValueHitRow[]>();
    for (const v of valueHits) {
      const list = valuesByNode.get(v.nodeId) ?? [];
      list.push(v);
      valuesByNode.set(v.nodeId, list);
    }

    const ids = [...new Set([...nodeIds, ...valuesByNode.keys()])].slice(0, MAX_CANDIDATES);
    const empty: SearchResponse = { query: q, total: 0, truncated, limit: input.limit, offset: input.offset, results: [] };
    if (ids.length === 0) return empty;

    const nodes = await this.repo.findNodesByIds(ids);
    const skeleton = await this.repo.findSkeleton([...new Set(nodes.map((n) => n.structureId))]);
    const byId = new Map(skeleton.map((s) => [s.id, s]));

    const results: Scored[] = [];
    for (const node of nodes) {
      const path = this.pathTo(node.parentId, byId);
      if (path === null) continue;                                              // broken parent chain
      if (publicOnly && !path.every((p) => Boolean(p.isPublished))) continue;  // same as prunePublic
      results.push(this.toResult(node, path, valuesByNode.get(node.id) ?? [], q));
    }

    results.sort((a, b) =>
      b.score - a.score || a.title.localeCompare(b.title, "sv") || a.nodeId - b.nodeId);

    return {
      ...empty,
      total: results.length,
      results: results
        .slice(input.offset, input.offset + input.limit)
        .map(({ score: _score, ...r }) => r),
    };
  }

  /** From the parent up to the root, returned root first. null if the chain is broken or loops. */
  private pathTo(parentId: number | null, byId: Map<number, SkeletonRow>): SkeletonRow[] | null {
    const path: SkeletonRow[] = [];
    let id = parentId;
    while (id != null) {
      const row = byId.get(id);
      if (!row || path.length >= MAX_DEPTH) return null;
      path.unshift(row);
      id = row.parentId;
    }
    return path;
  }

  /** Builds one hit: which fields matched (shown to the user) and its rank. */
  private toResult(node: NodeHitRow, path: SkeletonRow[], values: ValueHitRow[], q: string): Scored {
    const ql = lower(q);
    const title = lower(node.title);
    const refCode = node.referenceCode ?? "";
    const ref = lower(refCode);

    const matches: SearchMatch[] = [];
    if (title.includes(ql)) matches.push({ field: "title", label: "Titel", snippet: node.title });
    if (ref.includes(ql)) matches.push({ field: "referenceCode", label: "Referenskod", snippet: refCode });
    if (node.description && lower(node.description).includes(ql)) {
      matches.push({ field: "description", label: "Beskrivning", snippet: snippet(node.description, q) });
    }
    for (const v of values) matches.push({ field: "property", label: v.label, snippet: snippet(v.valueText, q) });

    let score: number = RANK.OTHER_FIELD;
    if (ref === ql) score = RANK.EXACT_REFERENCE_CODE;
    else if (title === ql) score = RANK.EXACT_TITLE;
    else if (title.startsWith(ql)) score = RANK.TITLE_STARTS_WITH;
    else if (title.includes(ql) || ref.includes(ql)) score = RANK.TITLE_OR_CODE_CONTAINS;

    const toPathItem = (p: SkeletonRow): SearchPathItem => ({ id: p.id, title: p.title, referenceCode: p.referenceCode });

    return {
      nodeId: node.id,
      structureId: node.structureId,
      structureName: node.structureName,
      structureType: node.structureType,
      title: node.title,
      referenceCode: node.referenceCode,
      nodeType: { code: node.nodeTypeCode, name: node.nodeTypeName },
      path: path.map(toPathItem),
      matches,
      score,
    };
  }
}
