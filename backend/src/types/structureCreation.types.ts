export interface NewArchiveCreatorInput {
  name: string;
  start_year?: number | null;
  end_year?: number | null;
  description?: string | null;
}

export interface NewArchiveInput {
  reference_code: string;
  name: string;
}


export interface NewStructureInput {
  code: string;
  name: string;
  structure_type: "klassificering";
  version?: string | null;
  description?: string | null;
  valid_from?: Date | null;
  valid_to?: Date | null;
}

export interface CreateStructureRequest {
  createdBy: number | null;// förändras när man kan skapa en användare i applikationen

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