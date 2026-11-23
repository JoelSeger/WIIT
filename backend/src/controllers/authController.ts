import type { NextFunction, Request, Response } from "express";
import { BaseController } from "./baseController";
import { AuthService, InactiveUserError } from "../services/authService";
import type { SessionUser } from "../types/session";

const MAX_GROUPS = 50;

/** What the frontend gets about the logged-in user. Never the whole users row. */
function publicUser(u: SessionUser) {
  return { id: u.id, username: u.username, displayName: u.displayName, email: u.email, roles: u.roles };
}

/**
 *   POST /api/auth/dev-login   { username, groups[] }  -> logs in a fake user (dev only)
 *   GET  /api/auth/me                                  -> the logged-in user, or null
 *   POST /api/auth/logout                              -> ends the session
 */
export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  /**
   * Fake login for development. Only mounted when NODE_ENV !== 'production'
   * AND DEV_LOGIN=true (see authRoutes.ts). Uses the same AuthService.login as real SSO,
   * so the role logic tested here is the one production will use.
   */
  devLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(username)) {
      this.error(res, "username is required (letters, digits, . _ -)", 400);
      return;
    }

    const rawGroups: unknown = req.body?.groups ?? [];
    if (!Array.isArray(rawGroups) || rawGroups.length > MAX_GROUPS
        || !rawGroups.every((g) => typeof g === "string" && g.length <= 255)) {
      this.error(res, `groups must be a list of at most ${MAX_GROUPS} strings`, 400);
      return;
    }

    let user: SessionUser;
    try {
      user = await this.authService.login({
        adObjectId: `dev-${username}`,   // can never collide with a real Entra objectId
        username,
        groups: rawGroups as string[],
      });
    } catch (e) {
      if (e instanceof InactiveUserError) { this.forbidden(res, e.message); return; }
      throw e;   // Express 5 passes it on to the error middleware
    }

    // New session id at login, so a session id planted before login can't be reused (session fixation)
    req.session.regenerate((err) => {
      if (err) { next(err); return; }
      req.session.user = user;
      this.success(res, publicUser(user));
    });
  };

  me = (req: Request, res: Response): void => {
    this.success(res, req.user ? publicUser(req.user) : null);
  };

  logout = (req: Request, res: Response, next: NextFunction): void => {
    req.session.destroy((err) => {
      if (err) { next(err); return; }
      res.clearCookie("connect.sid");   // express-session's default cookie name
      this.success(res, null);
    });
  };
}
