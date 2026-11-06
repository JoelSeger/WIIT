import type { Request, Response } from "express";
import { BaseController } from "./baseController";
import { NodeCreationService, type CreateNodeRequest } from "../services/nodeCreationService";
import { ValidationError } from "../services/errorService";
import type { PropertyValueInput } from "../types/node.properties.types";
import type { Knex } from "knex";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function optionalString(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new ValidationError(`${field} must be a string`);
  const t = v.trim();
  if (t.length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return t === "" ? null : t;
}

function optionalDate(v: unknown, field: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !DATE.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ValidationError(`${field} must be a date as YYYY-MM-DD`);
  }
  return v;
}

/**
 * Validates the request body and returns a typed request. Throws ValidationError.
 * createdBy is taken from the logged-in user only.
 */
export function parseCreateNodeBody(body: unknown, userId: number | null): CreateNodeRequest {
  const b = (body ?? {}) as Record<string, unknown>;

  if (!isPositiveInt(b.structureId)) throw new ValidationError("structureId must be a positive integer");

  if (b.parentId !== undefined && b.parentId !== null && !isPositiveInt(b.parentId)) {
    throw new ValidationError("parentId must be a positive integer or null");
  }

  if (typeof b.nodeTypeCode !== "string" || b.nodeTypeCode.trim() === "") {
    throw new ValidationError("nodeTypeCode is required");
  }

  if (typeof b.title !== "string" || b.title.trim() === "") {
    throw new ValidationError("title is required");
  }
  if (b.title.trim().length > 500) throw new ValidationError("title must be at most 500 characters");

  if (b.sortOrder !== undefined && (!Number.isInteger(b.sortOrder) || (b.sortOrder as number) < 0)) {
    throw new ValidationError("sortOrder must be an integer of 0 or higher");
  }

  const validFrom = optionalDate(b.validFrom, "validFrom");
  const validTo = optionalDate(b.validTo, "validTo");
  if (validFrom && validTo && validFrom > validTo) {
    throw new ValidationError("validFrom must be before validTo");
  }

  let properties: PropertyValueInput[] = [];
  if (b.properties !== undefined && b.properties !== null) {
    if (!Array.isArray(b.properties)) throw new ValidationError("properties must be a list");
    properties = b.properties.map((p: unknown, i: number) => {
      const item = p as Record<string, unknown>;
      if (!item || typeof item.key !== "string" || item.key.trim() === "") {
        throw new ValidationError(`properties[${i}].key is required`);
      }
      return item as unknown as PropertyValueInput;
    });
  }

  return {
    structureId: b.structureId,
    parentId: (b.parentId as number | null | undefined) ?? null,
    nodeTypeCode: (b.nodeTypeCode as string).trim(),
    referenceCode: optionalString(b.referenceCode, "referenceCode", 100),
    previousReferenceCode: optionalString(b.previousReferenceCode, "previousReferenceCode", 100),
    title: (b.title as string).trim(),
    sortOrder: (b.sortOrder as number | undefined) ?? 0,
    description: optionalString(b.description, "description", 10000),
    validFrom,
    validTo,
    properties,
    createdBy: userId,
  };
}

export class NodeCreationController extends BaseController {
  private readonly service: NodeCreationService;

  constructor(knex: Knex) {
    super();
    this.service = new NodeCreationService(knex);
  }

  /** POST /api/nodes */
  createNode = async (req: Request, res: Response): Promise<void> => {
    try {
      const input = parseCreateNodeBody(req.body, req.user?.id ?? null);
      const node = await this.service.createNode(input);
      res.status(201);
      this.success(res, node, "Node created successfully");
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };
}
