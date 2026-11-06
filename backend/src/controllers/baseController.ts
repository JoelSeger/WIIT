import type { Response } from 'express';
import { ServiceError, isUniqueViolation } from '../services/errorService';

/**
 * The base controller all other controllers extend. Every endpoint answers with the same shape:
 *   success: { success: true, data, message }
 *   failure: { success: false, error }
 */
export abstract class BaseController {

  protected unauthorized(res: Response, message: string = "Unauthorized"): void {
    res.status(401).json({ success: false, error: message });
  }

  protected forbidden(res: Response, message: string = "Forbidden"): void {
    res.status(403).json({ success: false, error: message });
  }

  protected success<T>(res: Response, data: T, message?: string): void {
    res.json({ success: true, data, message });
  }

  protected error(res: Response, message: string, statusCode: number = 500): void {
    res.status(statusCode).json({ success: false, error: message });
  }

  /**
   * Maps an exception to a response. Services throw ServiceError subclasses (instanceof, never
   * message text); a SQL Server unique violation becomes 409 with a plain message; everything
   * else is logged and answered with a generic 500.
   */
  protected handleError(res: Response, err: unknown): void {
    if (err instanceof ServiceError) {
      this.error(res, err.message, err.statusCode);
      return;
    }
    if (isUniqueViolation(err)) {
      this.error(res, "A node or structure with the same unique key already exists", 409);
      return;
    }
    console.error("Unhandled error:", err);
    this.error(res, "An unexpected error occurred", 500);
  }
}
