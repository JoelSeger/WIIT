
import type {Request, RequestHandler, Response, NextFunction } from 'express';
import type {Knex} from 'knex';

/*
All calls require the role first -> requireRole('editor')
This has to change when Role checking is implemented, so this just picks the first 
user from the table!!!! 
the request goes then with an "authenticated" user

Factory returns (role?)=> RequestHandler. (Calledin server.ts. once)
Takes db to look up the user (later the user AD group roles??).
*/

export type AuthedRequest = Request &{ user?:{id:number}};


export function makeRequireRole(db: Knex): (role?:string)=>RequestHandler{ 
    return (_role?:string)=> async (req: AuthedRequest, _res: Response, next: NextFunction) =>{
        try{ const row = await db('users').first<{ id:number }>('id');
        req.user = row ? {id:row.id} :undefined;
        next();
    }catch(error){
        next(error);
    }};
}
