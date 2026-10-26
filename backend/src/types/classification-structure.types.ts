export interface CreateStructureInput {
  code: string;
  name: string;
  structure_type: string;
  description?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isPublished?: boolean;
  version?: string | null;
  agencyCode?: string | null;
  agencyName?: string | null;
  createdBy: number;
}