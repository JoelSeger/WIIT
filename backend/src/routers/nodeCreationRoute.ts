import { Router } from "express";
import type { Knex } from "knex";
import { NodeCreationController } from "../controllers/nodeCreationController";
import { NodePropertyController } from "../controllers/nodePropertyController";
import { NodeDeleteController } from "../controllers/nodeDeleteController";
import { requireRole } from "../middleware/auth";
import { UnitOfWork } from "../config/db";
import { NodeCreationService } from "../services/nodeCreationService";
import { NodeDeleteService } from "../services/nodeDeleteService";
import { NodePropertyService } from "../services/nodePropertyService";
import { NodeActivityService } from "../services/nodeActivityService";
import { NodeEditService } from "../services/nodeEditService";


export function createNodeCreationRouter(db: Knex): Router {
  const router = Router();

  const creation = new NodeCreationController(new NodeCreationService(new UnitOfWork(db)));
  const deletion = new NodeDeleteController(new NodeDeleteService(new UnitOfWork(db)));
  const properties = new NodePropertyController(
      new NodePropertyService(new UnitOfWork(db)),
      new NodeActivityService(new UnitOfWork(db)),
      new NodeEditService(new UnitOfWork(db))
  );

  // Creating and editing nodes is restricted to editors.
  router.post("/", requireRole("editor"), creation.createNode);

  // F3.2: edit the attributes of an existing node (columns + property values, in one transaction)
  router.patch("/:id", requireRole("editor"), properties.editNode);

  // F3.1: delete a node that has no children
  router.delete("/:id", requireRole("editor"), deletion.deleteNode);

  router.get("/:id/form", requireRole("editor"), properties.getForm);
  router.get("/:id/activities", requireRole("editor"), properties.getActivities);
    // Can be created on a process
  router.put("/:id/activities", requireRole("editor"), properties.saveActivities);
  router.put("/:id/publish", requireRole("editor"), properties.publishUnpublishNode)

  return router;
}
