/**
 * Data sent by GET /api/search (backend: controllers/searchController.ts).
 * Copy of the contract in backend/src/models/search/search.ts.
 */

/** One ancestor of a hit, root first. */
export interface SearchPathItem {
  id: number;
  title: string;
  referenceCode: string | null;
}

/** Why a node was found. */
export interface SearchMatch {
  field: 'title' | 'referenceCode' | 'description' | 'property';
  label: string;
  snippet: string;
}

export interface SearchResult {
  nodeId: number;
  structureId: number;
  structureName: string;
  structureType: string;
  title: string;
  referenceCode: string | null;
  nodeType: { code: string; name: string };
  path: SearchPathItem[];
  matches: SearchMatch[];
}

export interface SearchResponse {
  query: string;
  total: number;
  truncated: boolean;
  limit: number;
  offset: number;
  results: SearchResult[];
}
