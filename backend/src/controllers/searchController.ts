import type { Request, Response } from "express";
import { BaseController } from "./baseController";
import type { SearchService } from "../services/searchService";
import { hasRole } from "../middleware/auth";

export const MIN_QUERY = 2;
export const MAX_QUERY = 200;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * GET /api/search?q=…&limit=&offset=&structureId=&structureType=
 *
 * One endpoint for everyone: the backend decides what may be shown.
 * Editor = everything, anyone else = public mode (F5.4). The search field sits in the
 * nav on both public and admin pages, so the frontend cannot ask for the wrong mode.
 */
export class SearchController extends BaseController {
  constructor(private readonly searchService: SearchService) {
    super();
  }

  search = async (req: Request, res: Response): Promise<void> => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
      this.error(res, `q must be ${MIN_QUERY}–${MAX_QUERY} characters`, 400);
      return;
    }

    const limit = Math.min(Math.max(Math.trunc(Number(req.query.limit)) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    const offset = Math.max(Math.trunc(Number(req.query.offset)) || 0, 0);

    let structureId: number | undefined;
    if (req.query.structureId !== undefined) {
      structureId = Number(req.query.structureId);
      if (!Number.isInteger(structureId) || structureId <= 0) {
        this.error(res, "Invalid structureId", 400);
        return;
      }
    }

    let structureType: string | undefined;
    if (req.query.structureType !== undefined) {
      if (typeof req.query.structureType !== "string" || !/^[a-z_]{1,20}$/.test(req.query.structureType)) {
        this.error(res, "Invalid structureType", 400);
        return;
      }
      structureType = req.query.structureType;
    }

    const publicOnly = !hasRole(req, "editor");

    try {
      const data = await this.searchService.search({ q, limit, offset, structureId, structureType }, publicOnly);
      this.success(res, data);
    } catch (e: unknown) {
      // logged, not sent to the client
      console.error(e);
      this.error(res, "Search failed", 500);
    }
  };
}
