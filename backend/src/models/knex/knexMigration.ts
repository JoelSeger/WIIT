export interface KnexMigraiton {
  id: number;
  name: string;
  batch: number;
  migrationTime: Date;
}
