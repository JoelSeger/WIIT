export interface CreateNodeData {
    structureId: number;
    parentId?: number | null;
    nodeTypeId: number;      
    referenceCode?: string | null;
    title: string;
    sortOrder?: number;
    description?: string | null;
    createdBy?: number | null;
}