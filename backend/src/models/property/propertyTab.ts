/**
 * What a tab shows (migration 013). Only 'fields' is built from field rows. The other kinds
 * need code to be drawn, so this list is fixed in code and in ck_property_tabs_kind.
 */
export type PropertyTabKind = "fields" | "activities" | "children" | "diagram";

/** One row in property_tabs (migration 013). */
export interface PropertyTab {
  key: string;
  label: string;
  kind: PropertyTabKind;
  sortOrder: number;
  isActive: boolean | null;
}
