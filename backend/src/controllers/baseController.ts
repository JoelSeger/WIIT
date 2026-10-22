import { Request, Response } from 'express';
import { RequestContext } from '../services/request-context';
import { User } from '../types/user';


/**
 * The base controller all other controllers should extend.
 */
export abstract class BaseController {
  constructor(protected requestContext: RequestContext) { };

  protected get currentUser(): User | undefined {
    const user = this.requestContext.user;
    //TODO: ADD LOGGER HERE
    return user;
  }

  protected requireAuth(): User {
    return this.requestContext.requireAuth();
  }

  protected hasPrivilages(privilageGroups: string[] | undefined): boolean {
    if (!privilageGroups || privilageGroups.length === 0) {
      return false;
    }

    const user = this.currentUser;
    if (!user) {
      return false;
    }

    const userRoles = user.roles || [];
    return privilageGroups.some(group => userRoles.includes(group))
  }

  protected unauthorized(res: Response, message: string = "Unauthorized"): void {
    //TODO: ADD LOGGER HERE
    res.status(401).json({ error: message });
  }

  protected forbidden(res: Response, message: string = "Forbidden"): void {
    //TODO: ADD LOGGER HERE
    res.status(403).json({ error: message });
  }

  protected success<T>(res: Response, data: T, message?: string): void {
    res.json({ success: true, data, message });
  }

  protected error(res: Response, message: string, statusCode: number = 500): void {
    //ADD LOGGER HERE
    res.status(statusCode).json({ success: false, error: message });
  }
}
