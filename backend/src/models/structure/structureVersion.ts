export interface StructureVersion {
  id: number,
  structureId: number,
  versionLabel: string,
  comment: string,
  snapshot: string,
  createdAt: Date,
  createdBy: number;
}
