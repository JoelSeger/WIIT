import { knex, type Knex } from "knex";
import config from "../../knexfile";
import knexStringcase from 'knex-stringcase';
import { createRepositories, Repositories } from "../repos/repositories";

const enviroment = process.env.NODE_ENV || 'development';

const knexConfig = config[enviroment] ?? config.development!;

// one to handle snake_case
export const db = knex({
  ...config[enviroment],
  ...knexStringcase(),
});

// one for keeping it snake_case
export const dbRaw = knex(knexConfig);

// A unit of work class, used for running transactions.
export class UnitOfWork {
  constructor(private readonly db: Knex) {}
  get repos(): Repositories { return createRepositories(this.db); }          // reads
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {            // writes
    return this.db.transaction((trx) => work(createRepositories(trx)));
  }
}
