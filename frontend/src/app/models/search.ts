export interface SearchInput {
  q: string;
  limit: number;
  offset: number;
  structureId?: number;
  structureType?: string;
}

export interface SearchPathItem {
  id: number;
  title: string;
  referenceCode: string | null;
}

export interface SearchMatch {
  field: "title" | "referenceCode" | "description" | "property";
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
