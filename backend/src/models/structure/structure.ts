
export interface Structure {
  id: number;
  code: string;
  name: string;
  structure_type: "klassificering" | "arkivforteckning" | "forvaring";
  description?: string | null;
  valid_from?: Date | null;
  valid_to?: Date | null;
  is_published: boolean;
  version?: string | null;
  previous_structure_id?: number | null;
  created_at?: Date;
  created_by?: number | null;
  updated_at?: Date;
  updated_by?: number | null;
}
