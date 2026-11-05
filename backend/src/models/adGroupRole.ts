export interface AdGroupRole {
  id: number;
  adGroup: string;
  role: string;
  structureId: number | null;
  createdAt?: Date;
}
