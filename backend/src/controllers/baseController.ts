import type { Response } from 'express';
import type { User } from '../models/user';
import type { RequestContext } from '../types/requestContext';


/** Shared request, database, access-check, and response helpers for API controllers. */
export abstract class BaseController {
  protected readonly db: RequestContext['db'];


  /* This stores the request-specific context supplied by the route handler and exposes its shared database connection to subclasses.
   This lets each controller use the current user and database without rebuilding those dependencies. */
  constructor(protected readonly requestContext: RequestContext) {
    this.db = requestContext.db;
  }

  /* This reports whether this HTTP request has a user attached to its session context.
  Controllers use this before protected changes so an anonymous request receives an authentication error. */
  protected isAuthenticated(): boolean {
    return this.requestContext.user !== undefined;
  }


  /* Returns the authenticated user object for code that needs the user's identity. It throws when no user is attached,
  so callers should normally check isAuthenticated before invoking it. */
  protected requireAuth(): User {
    const user = this.requestContext.user;
    if (!user) throw new Error('Authentication required.');
    return user;
  }



  /** Temporary role stub; the final SSO/session role source has not been decided.
   It compares the requested permission-group names with the current session user's roles,
   permissions, and groups. It allows the operation if any name matches, and denies it when the user or
   allowed-group list is empty. */
  protected isUserPrivilegeGroup(privilegeGroups: string[] | undefined): boolean {
    if (!privilegeGroups?.length) return false;
    const user = this.requestContext.user;
    const userGroups = [...(user?.roles ?? []), ...(user?.permissions ?? []), ...(user?.groups ?? [])];
    return privilegeGroups.some((group) => userGroups.includes(group));
  }

  protected unauthorized(res: Response, message = 'Unauthorized'): void {
    res.status(401).json({ error: message });
  }

  protected forbidden(res: Response, message = 'Forbidden'): void {
    res.status(403).json({ error: message });
  }

  protected success<T>(res: Response, data: T, message?: string): void {
    res.json({ success: true, data, message });
  }

  protected error(res: Response, message: string, statusCode = 500): void {
    res.status(statusCode).json({ success: false, error: message });
  }
}
