import { Router } from "express";
import type { Knex } from "knex";

import { StructureEditController } from "../controllers/structureEditConrtoller";

import { StructureCreationController } from "../controllers/structureCreationController";
import { requireRole } from "../middleware/auth";

export function createStructureCreationRoutes(knex: Knex): Router {
  const router = Router();
  const controller = new StructureCreationController(knex);

  router.post("/", requireRole("editor"), controller.create);

  return router;
}

/**
 * F1.1.2 – read and edit one structure.
 * Restricted to editors, like creating a structure.
 */
export function createStructureEditRoutes(knex: Knex): Router {
  const router = Router();
  const controller = new StructureEditController(knex);

  router.get("/:id", requireRole("editor"), controller.getStructure);
  router.patch("/:id", requireRole("editor"), controller.editStructure);

  return router;
}
