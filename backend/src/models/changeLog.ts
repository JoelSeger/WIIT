export interface ChangeLog {
  id: number;
  entityType: string;
  entityId: number;
  structureId: number | null;
  action: string | null;
  oldValue: string | null;
  newValue: string | null;
  comment: string | null;
  changedBy: number | null;
  changedAt: Date;
}
