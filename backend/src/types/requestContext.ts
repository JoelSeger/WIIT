import type { Request } from 'express';
import type { Knex } from 'knex';
import type { User } from '../models/user';

export type SessionUser = User & {
  roles?: string[];
  permissions?: string[];
  groups?: string[];
};

/** Request-scoped dependencies shared by a controller handling one HTTP request. */
export class RequestContext {
  readonly user: SessionUser | undefined;


  /* This bundles the Express request and Knex connection for one controller invocation, and copies the user attached
   by authentication middleware. Controllers use this object to access request identity and the database consistently. */
  constructor(readonly request: Request, readonly db: Knex) {
    this.user = request.user as SessionUser | undefined;
  }
}
