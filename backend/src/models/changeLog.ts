export interface ChangeLog {
  id: number;
  entityType: string;
  entityId: number;
  structureId: number;
  action: string;
  oldValue: string;
  newValue: string;
  comment: string;
  changedBy: number;
  changedAt: Date;
}
