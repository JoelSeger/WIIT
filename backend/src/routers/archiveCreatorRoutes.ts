import { Router } from "express";
import type { Knex } from "knex";
import { hasRole } from "../middleware/auth";
import { ArchiveCreatorSummaryRepository } from "../repos/archiveCreatorSummaryRepository";

/**
 * GET /api/archive-creators - all arkivbildare with the ids of their structures
 *
 * Editor sees everything, everyone else only published data (same rule as /api/structures).
 * Used by the frontend tree view: Struktur / arkivbildare / structures.
 */
export function createArchiveCreatorRouter(db: Knex): Router {
  const router = Router();
  const creators = new ArchiveCreatorSummaryRepository(db);

  router.get("/", async (req, res, next) => {
    try {
      const publicOnly = !hasRole(req, "editor");
      const data = await creators.findSummaries(publicOnly);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
