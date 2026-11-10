import type { NextFunction, Request, RequestHandler, Response } from 'express';
import logger from '../config/logger';

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = req.session.user;
  next();
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    logger.warn(req.user, 'Unauthorized')
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// TODO: look the user's AD groups up in ad_group_roles
/** true/false instead of 403 – for endpoints that answer everyone but show more to some (e.g. search). */
export function hasRole(req: Request, ...roles: string[]): boolean {
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true') return true;
  return roles.some((r) => req.user?.adObjectId?.includes(r));
}

export const requireRole = (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (!hasRole(req, ...roles)) {
      logger.warn(req.user, 'Forbidden');
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
