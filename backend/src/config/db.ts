import knex from "knex";
import config from '../../knexfile'
import knexStringcase from 'knex-stringcase';

const enviroment = process.env.NODE_ENV || 'development';

export const db = knex({
  ...config[enviroment],
  ...knexStringcase(),
});
