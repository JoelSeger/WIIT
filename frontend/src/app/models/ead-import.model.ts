/**
 * Data for the EAD import (backend: ead/importRoute.ts, services/EADImportService.ts).
 * Keep in sync with PreviewResult and ImportResult in the backend.
 */
import type { StructureTypeCode } from './structure.model';

/** One problem in the file, with an XPath-like path when the backend knows where. */
export interface EadIssue {
  path?: string;
  message: string;
}

/** POST /api/import/ead/preview: what an import would create. Writes nothing. */
export interface EadPreview {
  valid: boolean;
  metadata: {
    recordId: string | null;
    titleProper: string | null;
    agencyName: string | null;
    eadVersion: string | null;
  };
  trees: { name: string; structureType: StructureTypeCode; nodeCount: number }[];
  nodeCount: number;
  errors: EadIssue[];
  warnings: EadIssue[];
}

/** POST /api/import/ead: answer 201. */
export interface ImportResponse {
  structures: {
    id: number;
    code: string;
    name: string;
    structureType: StructureTypeCode;
    nodeCount: number;
  }[];
  relationCount: number;
  createdNodeTypes: string[];
  warnings: string[];
}

/** Error body from the import routes (400 also has issues). */
export interface ImportErrorBody {
  error: string;
  issues?: EadIssue[];
}
