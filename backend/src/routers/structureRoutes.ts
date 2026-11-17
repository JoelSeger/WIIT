import { Router } from "express";
import type { Knex } from "knex";
import { hasRole } from "../middleware/auth";
import { StructureRepository } from "../repos/structureRepository";
import { StructureController } from "../controllers/structureController";
import { StructureEditService } from "../services/structureEditService";

/**
 * GET /api/structures  - all structures (id, code, name, type …)
 * GET /api/structures?type=forvaring - only one structure type
 *
 * Editor sees everything, everyone else only published structures (same rule as search).
 * Used by the frontend to choose a structure for the tree view and the export.
 */
export function createStructureRouter(db: Knex): Router {
  const router = Router();
    const structures = new StructureRepository(db);
    const controller = new StructureController(new StructureEditService(db));

    //This should call a service not a repo directly.
  router.get("/", async (req, res, next) => {
    try {
      const type = typeof req.query.type === "string" ? req.query.type : undefined;
      const publicOnly = !hasRole(req, "editor");
      const data = await structures.findSummaries(type, publicOnly);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  });

    router.put("/publish", controller.flipPublished);
  return router;
}
