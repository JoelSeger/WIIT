import knex from "knex";
import config from "../../knexfile";
import knexStringcase from 'knex-stringcase';

const enviroment = process.env.NODE_ENV || 'development';

const knexConfig = config[enviroment] ?? config.development!;

// one to handle snake_case
export const db = knex({
  ...config[enviroment],
  ...knexStringcase(),
});

// one for keeping it snake_case
export const dbRaw = knex(knexConfig);
