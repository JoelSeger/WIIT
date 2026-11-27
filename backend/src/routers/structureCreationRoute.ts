import { Router } from "express";
import type { Knex } from "knex";
import { StructureCreationController } from "../controllers/structureCreationController";
import { requireRole } from "../middleware/auth";
import { UnitOfWork } from "../config/db";

export function createStructureCreationRoutes(db: Knex): Router {
  const router = Router();
  const controller = new StructureCreationController(new UnitOfWork(db));

  router.post("/", requireRole("editor"), controller.create);

  return router;
}
