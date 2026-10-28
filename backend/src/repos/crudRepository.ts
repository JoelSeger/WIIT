
import type { Knex } from "knex";

interface Writer<T> {
  create(item: Omit<T, "id">): Promise<T>;
  createMany(items: Omit<T, "id">[]): Promise<T[]>;
  update(id: number, item: Partial<T>): Promise<boolean>;
  delete(id: number): Promise<boolean>;
}

interface Reader<T> {
  find(item: Partial<T>): Promise<T[]>;
  findOne(id: number | Partial<T>): Promise<T | undefined>;
  findAll(limit?: number, offset?: number): Promise<T[]>;
  exists(id: number | Partial<T>): Promise<boolean>;
}

export abstract class CrudRepository<T>
  implements Reader<T>, Writer<T>
{
  constructor(
    public readonly knex: Knex,
    public readonly tableName: string,
    protected readonly trx?: Knex.Transaction,
  ) {}

  public get qb(): Knex.QueryBuilder {
    return (this.trx ?? this.knex)(this.tableName);
  }

  async find(item: Partial<T>): Promise<T[]> {
    return this.qb.where(item).select() as Promise<T[]>;
  }

  async findAll(
    limit: number = 100,
    offset: number = 0,
  ): Promise<T[]> {
    return this.qb
      .select()
      .limit(limit)
      .offset(offset) as Promise<T[]>;
  }

  async findOne(
    id: number | Partial<T>,
  ): Promise<T | undefined> {
    const query = typeof id === "number" ? { id } : id;

    return this.qb.where(query).first() as Promise<T | undefined>;
  }

  async exists(id: number | Partial<T>): Promise<boolean> {
    const query = typeof id === "number" ? { id } : id;
    const row = await this.qb.where(query).first();

    return row !== undefined;
  }

  async create(item: Omit<T, "id">): Promise<T> {
    const [created] = await this.qb.insert(item).returning("*");

    return created as T;
  }

  async createMany(items: Omit<T, "id">[]): Promise<T[]> {
    return this.qb.insert(items).returning("*") as Promise<T[]>;
  }

  async update(
    id: number,
    item: Partial<T>,
  ): Promise<boolean> {
    const count = await this.qb.where({ id }).update(item);

    return Number(count) > 0;
  }

  async delete(id: number): Promise<boolean> {
    const count = await this.qb.where({ id }).del();

    return Number(count) > 0;
  }
}
