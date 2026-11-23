  /**
   * Types shared by the EAD import: eadParser.ts → eadMapper.ts → eadImport.ts.
   * They describe the file as read, before anything is written to the database.
   */

  /** Raw object produced by fast-xml-parser. */
  export type ParsedEad = Record<string, unknown>;

  /** A problem found while reading a file. path is an XPath-like location, e.g. /ead/archdesc. */
  export interface EadIssue {
    path?: string;
    message: string;
  }

  /**
   * The two formats the import reads:
   *   ead3    EAD3 (Klara's export of the informationshanteringsplan, WIIT's own export)
   *   ra-ead  Riksarkivet's RA-EAD, an EAD 2002 variant (the old arkivförteckningar GV.ead / LS.ead)
   */
  export type EadFormat = "ead3" | "ra-ead";

  /**
   * RA-EAD has one unnamed <odd> per series and volume: its Anmärkning. This is the key of the
   * field it is stored in. The RA-EAD export writes the same field back as a plain <odd>.
   */
  export const RA_EAD_NOTE_KEY = "anmarkning";

  /** The document-level information in <control> (EAD3) or <eadheader> (RA-EAD). */
  export interface EadMetadata {
    format: EadFormat;
    recordId: string | null;
    titleProper: string | null;
    edition: string | null;
    agencyName: string | null;
    countryCode: string | null;
    languageCode: string | null;
    scriptCode: string | null;
    publicationStatus: string | null;
    eadVersion: string;
  }

  /** One <didnote>. Klara uses localtype="structuralunitdescription" to name the level. */
  export interface EadDidNote {
    localtype: string | null;
    text: string | null;
  }

  /** An element that has no field of its own on EadNode (physloc, legalstatus, relation, odd …). */
  export interface EadProperty {
    element: string;
    localtype: string | null;
    label: string | null;
    value: string | null;
  }

  /** One <ref> inside <unitid localtype="relations">: a link to another <c> by its @id. */
  export interface EadRef {
    targetEadId: string | null;
    label: string | null;
    linkRole: string | null;
  }

  /** <archdesc> or one <c>, with its children. */
  export interface EadNode {
    nodeType: "ead_root" | "ead_component";
    name: string;
    unitid: string | null;
    unitidLabel: string | null;
    eadId: string | null;
    level: string | null;
    otherlevel: string | null;
    structuralUnitDescription: string | null;
    didNotes: EadDidNote[];
    audience: string | null;
    /** Text of <abstract>. The description shown to users is scopeContent. */
    description: string | null;
    /** Text of <scopecontent>; Klara's escaped <br/> has been turned into line breaks. */
    scopeContent: string | null;
    appraisal: string | null;
    /** Text of <accessrestrict>, also when Klara wraps it in a nested <archdesc>. */
    accessRestrict: string | null;
    modifiedAt: Date | null;
    modifiedBy: string | null;
    /** From <unitdatestructured><daterange>; only full YYYY-MM-DD dates. */
    validFrom: string | null;
    validTo: string | null;
    properties: EadProperty[];
    refs: EadRef[];
    children: EadNode[];
  }

  /**
   * The arkiv and arkivbildare that an RA-EAD file describes in <archdesc level="fonds">.
   * The import uses it to find or create the rows in archives / archive_creators.
   */
  export interface EadArchive {
    /** <archdesc><did><unittitle>, e.g. "Gemensam förvaltning 1 juli 1998 - 2015". */
    name: string;
    /** <origination><corpname role="arkivbildare">, e.g. "Malmö högskola 1998-2015". */
    creatorName: string | null;
    /** corpname/@authfilenumber as written in the file, e.g. "/5". */
    creatorExternalId: string | null;
    /** <custodhist> followed by a fonds-level <odd>: the arkivbeskrivning / history text. */
    description: string | null;
  }

  /** Result of EadMapper.map: the metadata and the <archdesc> tree. */
  export interface MappedEad {
    metadata: EadMetadata;
    rootNode: EadNode | null;
    /** Only set for RA-EAD files. */
    archive: EadArchive | null;
  }