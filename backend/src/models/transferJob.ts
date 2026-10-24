export interface TransferJob {
  id: number;
  direction: string;
  format: string;
  structureId: number;
  fileName: string;
  status: string;
  nodeCount: number;
  message: string | null;
  startedAt?: Date;
  finishedAt?: Date;
  createdBy?: number | null;
}
