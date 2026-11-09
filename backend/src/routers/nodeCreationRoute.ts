import { Router } from "express";
import type { Knex } from "knex";
import { NodeCreationController } from "../controllers/nodeCreationController";
import { NodePropertyController } from "../controllers/nodePropertyController";
import { requireRole } from "../middleware/auth";

export function createNodeCreationRouter(knex: Knex): Router {
  const router = Router();

  const creation = new NodeCreationController(knex);
  const properties = new NodePropertyController(knex);

  // Creating and editing nodes is restricted to editors.
  router.post("/", requireRole("editor"), creation.createNode);

  // F3.2: edit the attributes of an existing node (columns + property values, in one transaction)
  router.patch("/:id", requireRole("editor"), properties.editNode);

  router.get("/:id/form", requireRole("editor"), properties.getForm);
  router.get("/:id/activities", requireRole("editor"), properties.getActivities);
    // Can be created on a process  
  router.put("/:id/activities", requireRole("editor"), properties.saveActivities);

  return router;
}
