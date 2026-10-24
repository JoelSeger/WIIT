import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = req.session.user;
  next();
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// TODO: look the user's AD groups up in ad_group_roles
export const requireRole = (...roles: string[]): RequestHandler =>
  (req, res, next) => {
    if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true') {
      next();
      return;
    }
    const has = roles.some((r) => req.user?.adObjectId?.includes(r));
    if (!has) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
