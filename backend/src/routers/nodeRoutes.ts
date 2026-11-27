import { Router } from "express";
import type { Knex } from "knex";
import { NodeController } from "../controllers/nodeController";
import { NodeTreeService } from "../services/nodeTreeService";
import { requireRole } from "../middleware/auth";
import { UnitOfWork } from "../config/db";

export function createNodeRouter(db: Knex): Router {
  const router = Router();
  const controller = new NodeController(new NodeTreeService(new UnitOfWork(db)));

  // test URI only! NEEDS CHANGE!
  router.get("/structures/:id/tree", requireRole("editor"), controller.getTree(false));
  router.get("/public/structures/:id/tree", controller.getTree(true));

  return router;
}
