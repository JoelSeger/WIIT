// camelCase: knex-stringcase maps snake_case columns to these names on read and write.
export interface Structure {
  id: number;
  code: string;
  name: string;
  structureType: "klassificering" | "arkivforteckning" | "forvaring";
  description: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  isPublished: boolean;
  agencyCode: string | null;
  agencyName: string | null;
  languageCode: string;
  license: string | null;
  version: string | null;
  previousStructureId: number | null;
  externalId: string | null;
  createdAt?: Date;
  createdBy?: number | null;
  updatedAt?: Date;
  updatedBy?: number | null;
}
