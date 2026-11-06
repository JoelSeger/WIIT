export interface NewArchiveCreatorInput {
  name: string;
  startYear?: number | null;
  endYear?: number | null;
  description?: string | null;
}

export interface NewArchiveInput {
  referenceCode: string;
  name: string;
}


export interface NewStructureInput {
  code: string;
  name: string;
  structure_type: "klassificering";
  version?: string | null;
  description?: string | null;
  validFrom?: Date | null;
  validTo?: Date | null;
  agencyCode?: string | null;
  agencyName?: string | null;
  languageCode?: string | null;
  license?: string | null;
  externalId?: string | null;
}

export interface CreateStructureRequest {
  /** Set by the controller from the logged-in user. Any value sent by the client is ignored. */
  createdBy: number | null;

  // Välja en befintlig arkivbildare
  archiveCreatorId?: number;

  // Eller skapa en ny arkivbildare
  newArchiveCreator?: NewArchiveCreatorInput;

  // Arkiven som strukturen ska kopplas till
  // Required när man väljer en befintlig struktur
  archiveId?: number;

  newArchive?: NewArchiveInput;

  structure: NewStructureInput;
}