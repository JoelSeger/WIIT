export interface Structure {
  id: number;
  code: string;
  name: string;
  structureType: string;
  description?: string;
  validFrom?: Date;
  validTo?: Date;
  isPublished: boolean;
  createdAt: Date;
  createdBy: number;
  updatedAt?: Date;
  updatedBy?: number;
  agencyCode?: string;
  agencyName?: string;
  languageCode: string;
  license?: string;
  version?: string;
  previousStructureId?: number;
}
