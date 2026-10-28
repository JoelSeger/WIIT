/**import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { BaseController } from "./baseController";
import { NodeService } from "../services/nodeService";

export class NodeController extends BaseController {
  constructor(
    private readonly nodeService: NodeService
  ) {
    super();
  }

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const node = await this.nodeService.create(
        req.body
      );

      this.success(
        res,
        node,
        "Node created successfully."
      );
    } catch (error) {
      next(error);
    }
  };
}*/