export interface CreateNodeData {
    structureId: number;
    parentId?: number | null;
    nodeTypeId: number;      
    referenceCode?: string | null;
    title: string;
    sortOrder?: number;
    description?: string | null;
    previousReferenceCode?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
    createdBy?: number | null;
}