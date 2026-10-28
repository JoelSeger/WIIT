
import { Router } from "express";
import type { Knex } from "knex";

import { StructureCreationController } from "../controllers/structureCreationController";

export function createStructureCreationRoutes(knex: Knex): Router {
  const router = Router();
  const controller = new StructureCreationController(knex);

  router.post("/", controller.create);

  return router;
}
