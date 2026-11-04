import { Router } from "express";
import type { Knex } from "knex";
import { NodeController } from "../controllers/nodeCreationController";
import { NodeCreationService } from "../services/nodeCreationService";

export function createNodeCreationRouter(knex: Knex): Router {
    const router = Router();

    const nodeService = new NodeCreationService(knex);
    const nodeController = new NodeController(nodeService);

    router.post("/", nodeController.createNode);

    return router;
}