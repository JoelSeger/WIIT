import { Router } from "express";
import type { Knex } from "knex";
import { SearchController } from "../controllers/searchController";
import { SearchService } from "../services/searchService";
import { SearchRepository } from "../repos/searchRepository";

/** mounted at /api/search in server.ts. No requireRole in frontend
 * the controller picks public or editor mode */
export function createSearchRouter(db: Knex): Router {
  const router = Router();
  const controller = new SearchController(new SearchService(new SearchRepository(db)));

  router.get("/", controller.search);

  return router;
}
