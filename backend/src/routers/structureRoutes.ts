import { Router } from "express";
import type { Knex } from "knex";
import { hasRole, requireRole } from "../middleware/auth";
import { StructureController } from "../controllers/structureController";
import { StructureEditService } from "../services/structureEditService";
import { UnitOfWork } from "../config/db";
import { StructureCreationController } from "../controllers/structureCreationController";

/**
 * GET /api/structures  - all structures (id, code, name, type …)
 * GET /api/structures?type=forvaring - only one structure type
 *
 * Editor sees everything, everyone else only published structures (same rule as search).
 * Used by the frontend to choose a structure for the tree view and the export.
 */
export function createStructureRouter(db: Knex): Router {
  const router = Router();
  const controller = new StructureController(new StructureEditService(new UnitOfWork(db)));
  const createController = new StructureCreationController(new UnitOfWork(db));


  router.post("/", requireRole("editor"), createController.create);

  // Rework this to fit the current pattern
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

  router.put("/:id/publish", controller.flipPublished, requireRole("editor"));

  return router;
}
