export interface CreateNodeInput {
  structureId: number;
  parentId: number | null;
  nodeTypeId: number;
  referenceCode: string | null;
  title: string;
  description?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
}

export interface NodeType {
  id: number;
  code: string;
  name: string;
  structure_type: string;
  is_active: boolean;
}

export interface StructureRecord {
  id: number;
  code: string;
  name: string;
  structure_type: string;
}

export interface NodeRecord {
  id: number;
  structure_id: number;
  parent_id: number | null;
  node_type_id: number;
  reference_code: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
}