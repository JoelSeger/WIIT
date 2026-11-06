import type { Request, Response } from "express";
import type { Knex } from "knex";

import { BaseController } from "./baseController";
import { StructureCreationService } from "../services/structureCreatorService";
import { ValidationError } from "../services/errorService";
import type { CreateStructureRequest } from "../types/structureCreation.types";

const isPositiveInt = (v: unknown) => Number.isInteger(v) && (v as number) > 0;

function validateBody(body: unknown): void {
  const b = (body ?? {}) as Record<string, any>;
  if (!b.structure || typeof b.structure !== "object") {
    throw new ValidationError("Structure data is required.");
  }
  const s = b.structure;
  if (typeof s.code !== "string" || s.code.trim() === "") throw new ValidationError("Structure code is required.");
  if (s.code.trim().length > 50) throw new ValidationError("Structure code must be at most 50 characters.");
  if (typeof s.name !== "string" || s.name.trim() === "") throw new ValidationError("Structure name is required.");
  if (s.name.trim().length > 255) throw new ValidationError("Structure name must be at most 255 characters.");

  if (b.archiveId !== undefined && !isPositiveInt(b.archiveId)) throw new ValidationError("archiveId must be a positive integer.");
  if (b.archiveCreatorId !== undefined && !isPositiveInt(b.archiveCreatorId)) {
    throw new ValidationError("archiveCreatorId must be a positive integer.");
  }
  if (b.newArchive && (typeof b.newArchive.name !== "string" || b.newArchive.name.trim() === "")) {
    throw new ValidationError("newArchive.name is required.");
  }
  if (b.newArchiveCreator && (typeof b.newArchiveCreator.name !== "string" || b.newArchiveCreator.name.trim() === "")) {
    throw new ValidationError("newArchiveCreator.name is required.");
  }
}

export class StructureCreationController extends BaseController {
  private readonly structureCreationService: StructureCreationService;

  constructor(knex: Knex) {
    super();
    this.structureCreationService = new StructureCreationService(knex);
  }

  /** POST /api/structures */
  create = async (req: Request, res: Response): Promise<void> => {
    try {
      validateBody(req.body);
      const body = req.body as CreateStructureRequest;

      // createdBy comes from the logged-in user, never from the body.
      const request: CreateStructureRequest = { ...body, createdBy: req.user?.id ?? null };

      const result = await this.structureCreationService.create(request);
      res.status(201);
      this.success(res, result, "Structure created successfully.");
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };
}
