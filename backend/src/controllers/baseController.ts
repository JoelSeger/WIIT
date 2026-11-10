import { Request, Response } from 'express';
import logger from '../config/logger';


/**
 * The base controller all other controllers should extend.
 */
export abstract class BaseController {

  protected unauthorized(res: Response, error: Error): void {
    logger.warn(error);
    res.status(401).json({ error: error.message });
  }

  protected forbidden(res: Response, error: Error): void {
    logger.warn(error);
    res.status(403).json({ error: error.message });
  }

  protected success<T>(res: Response, data: T, message?: string): void {
    logger.info(message);
    res.json({ success: true, data, message });
  }

  protected error(res: Response, error: Error, statusCode: number = 500): void {
    logger.error(error);
    res.status(statusCode).json({ success: false, error: error.message });
  }
}
