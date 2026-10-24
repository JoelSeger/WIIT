export interface TransferJob {
  id: number,
  direction: string,
  format: string,
  structureId: number,
  fileName: string,
  status: string,
  nodeCount: number,
  message: string,
  startedAt: Date,
  finishedAt: Date,
  createdBy: number;
}
