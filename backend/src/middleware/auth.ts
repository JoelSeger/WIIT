import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = req.session.user;
  next();
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

/**
 * true/false instead of 403 – for endpoints that answer everyone but show more to some (e.g. search).
 * The roles were looked up in ad_group_roles at login (AuthService.login) and stored in the session.
 */
export function hasRole(req: Request, ...roles: string[]): boolean {
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true') return true;
  const mine = req.user?.roles ?? [];
  // admin may do everything an editor may
  return mine.includes('admin') || roles.some((r) => mine.includes(r));
}

/**
 * 401 = not logged in (the frontend should send the user to login),
 * 403 = logged in but missing the role.
 */
export const requireRole = (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (hasRole(req, ...roles)) { next(); return; }
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    res.status(403).json({ success: false, error: 'Forbidden' });
  };
