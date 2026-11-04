import { Router } from "express";
import { Knex } from "knex";
import { ClassificationService } from "../services/classificationService";
import { StructureRepository } from "../repos/structureRepository";
import { NodeTypeRepository } from "../repos/node/nodeTypeRepository";
import { ChangeLogRepository } from "../repos/changeLogRepository";
import { PropertyDefinitionRepository } from "../repos/propertyDefinitionRepository";
import { NodeRepository } from "../repos/node/nodeRepository";
import { NodePropertyValuesRepository } from "../repos/node/nodePropertyValuesRepository";
import { ClassificationController } from "../controllers/classificationController";

export function createClassificationRouter(db: Knex): Router {
  const router = Router();

  const service = new ClassificationService(
    new StructureRepository(db),
    new NodeRepository(db),
    new NodeTypeRepository(db),
    new PropertyDefinitionRepository(db),
    new NodePropertyValuesRepository(db),
    new ChangeLogRepository(db)
  );

  const controller = new ClassificationController(service);

// NEEDS A CONTROLLER TO WORK!
  router.get('/tree', controller.tree);
  /**
  router.get('/:id');
  router.post('/');
  router.put('/:id');
  router.delete('/:id');
  */
  return router;
}
