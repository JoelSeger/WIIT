
import { Router } from "express";
import type { Knex } from "knex";
import { NodeController } from "../controllers/nodeController";
import { NodeService } from "../services/nodeService";

export function createNodeRouter(knex: Knex): Router {
    const router = Router();

    const nodeService = new NodeService(knex);
    const nodeController = new NodeController(nodeService);

    router.post("/", nodeController.createNode);

    return router;
}
