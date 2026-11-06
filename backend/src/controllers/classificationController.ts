import { Request, Response } from "express";
import { ClassificationService } from "../services/classificationService";
import { BaseController } from "./baseController";

export class ClassificationController extends BaseController {
  constructor(private readonly service: ClassificationService) {
    super();
  }

  tree = async (req: Request, res: Response): Promise<void> => {
    try {
      const tree = await this.service.tree();
      if (tree === null) {
        this.error(res, "Could not find tree", 404);
        return;
      }
      res.status(200).json(tree);
    } catch (e: any) {
      this.error(res, e.message, 500)
    }
  }

}
