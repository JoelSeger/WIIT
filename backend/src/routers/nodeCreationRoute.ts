import { Router } from "express";
import type { Knex } from "knex";
import { NodeCreationController } from "../controllers/nodeCreationController";
import { NodePropertyController } from "../controllers/nodePropertyController";
import { NodeDeleteController } from "../controllers/nodeDeleteController";
import { NodeCreationService } from "../services/nodeCreationService";
import { NodeDeleteService } from "../services/nodeDeleteService";
import { NodePropertyService } from "../services/nodePropertyService";
import { NodeActivityService } from "../services/nodeActivityService";
import { NodeEditService } from "../services/nodeEditService";
import { requireRole } from "../middleware/auth";


export function createNodeCreationRouter(knex: Knex): Router {
  const router = Router();

  const creation = new NodeCreationController(new NodeCreationService(knex));
  const properties = new NodePropertyController(
      new NodePropertyService(knex),
      new NodeActivityService(knex),
      new NodeEditService(knex),
  );
  const deletion = new NodeDeleteController(new NodeDeleteService(knex));

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