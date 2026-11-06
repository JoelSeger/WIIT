/**
 *
 * This is the contract for frontend to build against.
 */

/** What the controller has validated and passes on to the service. */
export interface SearchInput {
  q: string;
  limit: number;
  offset: number;
  structureId?: number;
  structureType?: string;
}

/** One ancestor of a hit, root first, expand these to show the hit */
export interface SearchPathItem {
  id: number;
  title: string;
  referenceCode: string | null;
}

/** Why a node was found – shown under the hit. */
export interface SearchMatch {
  field: "title" | "referenceCode" | "description" | "property";
  label: string;     // "Titel", "Referenskod", "Beskrivning" or the field's label, e.g. "Sekretess"
  snippet: string;   // the text around the hit
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
  total: number;        // hits after the public filter (before limit/offset)
  truncated: boolean;   // true = more than MAX_CANDIDATES rows matched, refine the search
  limit: number;
  offset: number;
  results: SearchResult[];
}
