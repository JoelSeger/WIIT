import knex, { Knex } from "knex";
import config from "../../knexfile";

const db: Knex = knex(config.development);

export default db;