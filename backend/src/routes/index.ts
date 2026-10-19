import express, {type RequestHandler} from 'express';
import type {Knex} from 'knex';
import {makeArchivesRouter} from './archives';

/*
Each "sub-router" defines the full paths for /processes and /archives
*/

export interface ApiRouterDeps{
    db:Knex;
    requireRole(role? : string ) : RequestHandler;
}

export function makeApiRouter({db, requireRole}: ApiRouterDeps){
    const api = express.Router();
    api.use(makeArchivesRouter ({db, requireRole}));
    
    return api;
}