import { Request, Response } from "express";
import { BaseController } from "./baseController";
import { NodeService } from "../services/nodeService";

export class NodeController extends BaseController {
  constructor(private readonly nodeService: NodeService) {
    super();
  }

  getTree = (publicOnly: boolean) => async (req: Request, res: Response): Promise<void> => {
    const structureId = Number(req.params.id);
    if (!Number.isInteger(structureId) || structureId <= 0) {
      this.error(res, new Error(`Structure with ${structureId} was not found`), 400);
      return;
    }

    try {
      const tree = await this.nodeService.getTree(structureId, publicOnly);
      if (tree === null) {
        this.error(res, new Error("This structure did not return a tree",), 404);
        return;
      }
      this.success(res, tree)
    } catch (e: any) {
      this.error(res, e);
    }
  };
}
