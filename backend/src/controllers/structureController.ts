/**import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { BaseController } from "./baseController";
import { structureService } from "../services/structureService";

export class StructureController extends BaseController {
  constructor(
    private readonly structureService: StructureService
  ) {
    super();
  }

  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const structure = await this.structureService.create(
        req.body
      );

      this.success(
        res,
        structure,
        "Structure created successfully."
      );
    } catch (error) {
      next(error);
    }
  };
}*/