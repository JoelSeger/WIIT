import 'express-session';
import { User } from '../models/user';

/**
 * The logged-in user as stored in the session.
 * roles come from ad_group_roles at login ('admin' | 'editor' | 'viewer'),
 * so hasRole() does not have to query the database on every request.
 */
export type SessionUser = User & { roles: string[] };

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

declare global {
  namespace Express {
    interface Request {
      // set by attachUser from req.session.user
      user?: SessionUser;
    }
  }
}
