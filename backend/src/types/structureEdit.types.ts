/**
 * F1.1.2 – edit a (classification) structure.
 * The structure type is not part of the edit, so the same request edits a structure of any type.
 *
 * Partial update: a field that is left out (undefined) is not touched.
 * For the nullable fields, null clears the value. code, name and languageCode can never be cleared.
 */
export interface EditStructureRequest {
  structureId: number;
  code?: string;
  name?: string;
  description?: string | null;
  version?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  externalId?: string | null;
  /** Taken from the logged-in user by the controller – never from the request body. */
  updatedBy: number | null;
}

/** The columns of structures that F1.1.2 may change (the repository adds updated_at/updated_by). */
export interface StructureAttributeChanges {
  code?: string;
  name?: string;
  description?: string | null;
  version?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  externalId?: string | null;
}

/** What GET and PATCH /api/structures/:id answer with – the edit form needs all of it. */
export interface StructureDetails {
  id: number;
  code: string;
  name: string;
  structureType: string;
  description: string | null;
  version: string | null;
  validFrom: string | null;
  validTo: string | null;
  isPublished: boolean;
  previousStructureId: number | null;
  externalId: string | null;
  updatedAt: Date | null;
  updatedBy: number | null;
}
