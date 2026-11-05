
export interface KnexMigration {
  id: number;
  name: string;
  batch: number;
  migrationTime: Date;
}
