/*
The existing db file was JavaScript (db.js). Delete???
One Knex instance used for the whole app is the idea.
*/

import dotenv from 'dotenv/config';
import knex from 'knex';
import knexConfig from '../../knexfile';

export const db= knex(knexConfig.development);