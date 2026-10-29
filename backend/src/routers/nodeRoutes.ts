import { Router } from "express";
import type { Knex } from "knex";
import { NodeController } from "../controllers/nodeController";
import { NodeService } from "../services/nodeService";
import { NodeRepository } from "../repos/nodeRepository";
import { NodeTypeRepository } from "../repos/nodeTypeRepository";
import { PropertyDefinitionRepository } from "../repos/propertyDefinitionRepository";
import { StructureRepository } from "../repos/structureRepository";
import { requireRole } from "../middleware/auth";

export function createNodeRouter(db: Knex): Router {
  const router = Router();

  const service = new NodeService(
    new NodeRepository(db),
    new NodeTypeRepository(db),
    new PropertyDefinitionRepository(db),
    new StructureRepository(db),
  );
  const controller = new NodeController(service);

  // test URI only! NEEDS CHANGE!
  router.get("/structures/:id/tree", requireRole("editor"), controller.getTree(false));
  router.get("/public/structures/:id/tree", controller.getTree(true));

  return router;
}
