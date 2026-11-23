import type { PropertyValueInput } from "./node.properties.types";

/**
 * F3.2 – edit the attributes of an existing node.
 *
 * Partial update: a field that is left out (undefined) is not touched.
 * For the nullable fields, null clears the value. title can never be cleared.
 */
export interface EditNodeRequest {
  nodeId: number;
  title?: string;
  referenceCode?: string | null;
  previousReferenceCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  description?: string | null;
  /** Values of the node type's property fields (same shape as PUT /:id/properties). */
  properties?: PropertyValueInput[];
  /** rowVersion from the form the user opened. If set and the node has changed since: 409. */
  expectedRowVersion?: Buffer | null;
  /** Taken from the logged-in user by the controller – never from the request body. */
  updatedBy: number | null;
}

/** The columns of nodes that F3.2 may change (the repository adds updated_at/updated_by itself). */
export interface NodeAttributeChanges {
  title?: string;
  referenceCode?: string | null;
  previousReferenceCode?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  description?: string | null;
}
