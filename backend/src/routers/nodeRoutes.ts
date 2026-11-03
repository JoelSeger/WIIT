import { Router } from "express";
import type { Knex } from "knex";
import { NodeController } from "../controllers/nodeController";
import { NodeService } from "../services/nodeService";
import { NodeRepository } from "../repos/nodeRepository";
import { PropertyDefinitionRepository } from "../repos/propertyDefinitionRepository";
import { requireRole } from "../middleware/auth";
import { NodeRelationRepository } from "../repos/nodeRelationRepository";
import { UnitOfWork } from "../db/unitOfWork";

export function createNodeRouter(db: Knex): Router {
  const router = Router();

  const service = new NodeService(
    new NodeRepository(db),
    new NodeRelationRepository(db),
    new PropertyDefinitionRepository(db),
    new UnitOfWork(db),
  );
  const controller = new NodeController(service);

  // test URI only! NEEDS CHANGE!
  router.get("/structures/:id/tree", requireRole("editor"), controller.getTree(false));
  router.get("/public/structures/:id/tree", controller.getTree(true));

  return router;
}
