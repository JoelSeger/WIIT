import type { Knex } from "knex";

interface Reader<T> {
  find(item: Partial<T>): Promise<T[]>;
  findOne(id: string | Partial<T>): Promise<T>;
};

export abstract class BaseRepository<T> implements Reader<T>{
  constructor(
    public readonly knex: Knex,
    public readonly tableName: string,
  ) { };

  public get qb(): Knex.QueryBuilder {
    return this.knex(this.tableName);
  };

  find(item: Partial<T>): Promise<T[]> {
    return this.qb
      .where(item)
      .select()
  };

  findOne(id: string | Partial<T>): Promise<T> {
    return this.qb
      .where(id)
      .select()
  };
}
