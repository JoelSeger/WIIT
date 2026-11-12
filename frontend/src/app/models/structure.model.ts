/**
 * Data sent by GET /api/structures (backend: routers/structureRoutes.ts).
 * Keep in sync with backend/src/models/structure/structure.ts.
 */

/** Codes from the structure_types table (migration 008). */
export type StructureTypeCode = 'klassificering' | 'arkivforteckning' | 'forvaring';

/** One row in the structure list: no description or metadata. */
export interface StructureSummary {
  id: number;
  code: string;
  name: string;
  structureType: StructureTypeCode;
  isPublished: boolean | null;
  version: string | null;
}

/** Wrapper that BaseController.success() puts around data. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Labels shown in the UI for each structure type. */
export const STRUCTURE_TYPE_LABELS: Record<StructureTypeCode, string> = {
  klassificering: 'Klassificeringsstruktur',
  arkivforteckning: 'Arkivförteckning',
  forvaring: 'Förvaring',
};
