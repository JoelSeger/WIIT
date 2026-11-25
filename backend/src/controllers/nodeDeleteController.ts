import type { Request, Response } from "express";
import { BaseController } from "./baseController";
import type { NodeDeleteService } from "../services/nodeDeleteService";
import { ValidationError } from "../helpers/errorService";
import { isPositiveInt } from "./requestParsers";
import type { DeleteNodeRequest } from "../types/nodeDelete.types";

/** Validates the route parameter of DELETE /api/nodes/:id. Throws ValidationError. */
export function parseDeleteNodeRequest(rawId: unknown, userId: number | null): DeleteNodeRequest {
  const nodeId = typeof rawId === "string" && /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  if (!isPositiveInt(nodeId)) throw new ValidationError("A valid node id is required");
  return { nodeId, deletedBy: userId };
}

export class NodeDeleteController extends BaseController {
  constructor(private readonly service: NodeDeleteService) {
    super();
  }

  /** DELETE /api/nodes/:id   (F3.1) – only a node without children can be deleted. */
  deleteNode = async (req: Request, res: Response): Promise<void> => {
    try {
      const input = parseDeleteNodeRequest(req.params.id, req.user?.id ?? null);
      this.success(res, await this.service.deleteNode(input), "Node deleted");
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };
}