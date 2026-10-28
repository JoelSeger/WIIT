
import type { Request, Response } from "express";
import type { Knex } from "knex";

import { BaseController } from "./baseController";
import { StructureCreationService } from "../services/archiveCreatorService";
import type { CreateStructureRequest } from "../types/structureCreation.types";

export class StructureCreationController extends BaseController {
  private readonly structureCreationService: StructureCreationService;

  constructor(knex: Knex) {
    super();
    this.structureCreationService = new StructureCreationService(knex);
  }

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const request = req.body as CreateStructureRequest;

      if (!request || !request.structure) {
        this.error(res, "Structure data is required.", 400);
        return;
      }

      const result = await this.structureCreationService.create(request);

      res.status(201).json({
        success: true,
        message: "Structure created successfully.",
        data: result,
      });
    } catch (error: unknown) {
      console.error("Error creating structure:", error);

      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      this.error(res, message, 400);
    }
  };
}
