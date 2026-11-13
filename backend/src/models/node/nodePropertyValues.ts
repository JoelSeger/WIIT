export interface NodePropertyValues {
  id: number;
  nodeId: number;
  propertyDefinitionId: number;
  valueText?: string | null;
  valueNumber?: number | null;
  valueDate?: Date | string | null;
  valueBoolean?: boolean | null;
  /** Row number inside a repeatable field or table (migration 008). */
  valueOrder: number;
  /** The Eget checkbox – only for fields with hasOwnPublished (migration 011). */
  isOwn?: boolean | null;
  /** The Publicerad text box – only for fields with hasOwnPublished (migration 011). */
  publishedText?: string | null;
  updatedAt?: Date;
  updatedBy?: number | null;
}
