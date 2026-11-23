import { Router } from "express";
import type { Knex } from "knex";

import { StructureCreationController } from "../controllers/structureCreationController";
import { requireRole } from "../middleware/auth";

export function createStructureCreationRoutes(knex: Knex): Router {
  const router = Router();
  const controller = new StructureCreationController(knex);

  router.post("/", requireRole("editor"), controller.create);

  return router;
}
