import type { Request, Response } from "express";
import type { Knex } from "knex";
import { BaseController } from "./baseController";
import { StructureEditService } from "../services/EditStructureService";
import { ValidationError } from "../services/errorService";
import { isPositiveInt, optionalDate, optionalString } from "./requestParsers";
import type { EditStructureRequest } from "../types/structureEdit.types";

const has = (b: Record<string, unknown>, key: string): boolean => b[key] !== undefined;

/** Fields that exist on a structure but are deliberately not editable here (see StructureEditService). */
const LOCKED_FIELDS: Record<string, string> = {
  structureType: "The structure type cannot be changed",
  isPublished: "Publishing is a separate function",
  previousStructureId: "The previous structure cannot be changed here",
};

/** A text field that cannot be cleared (code, name). */
function requiredString(v: unknown, field: string, max: number): string {
  if (typeof v !== "string" || v.trim() === "") throw new ValidationError(`${field} cannot be empty`);
  if (v.trim().length > max) throw new ValidationError(`${field} must be at most ${max} characters`);
  return v.trim();
}

function parseStructureId(rawId: unknown): number {
  const id = typeof rawId === "string" && /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  if (!isPositiveInt(id)) throw new ValidationError("A valid structure id is required");
  return id;
}

/**
 * Validates the route parameter and the body of PATCH /api/structures/:id and returns a typed
 * request. Throws ValidationError. updatedBy is taken from the logged-in user only.
 */
export function parseEditStructureBody(rawId: unknown, body: unknown, userId: number | null): EditStructureRequest {
  const structureId = parseStructureId(rawId);
  const b = (body ?? {}) as Record<string, unknown>;
  const request: EditStructureRequest = { structureId, updatedBy: userId };

  for (const [field, message] of Object.entries(LOCKED_FIELDS)) {
    if (has(b, field)) throw new ValidationError(`${field}: ${message}`);
  }

  if (has(b, "code")) request.code = requiredString(b.code, "code", 50);
  if (has(b, "name")) request.name = requiredString(b.name, "name", 255);
  if (has(b, "description")) request.description = optionalString(b.description, "description", 10000);
  if (has(b, "version")) request.version = optionalString(b.version, "version", 50);
  if (has(b, "externalId")) request.externalId = optionalString(b.externalId, "externalId", 255);
  if (has(b, "validFrom")) request.validFrom = optionalDate(b.validFrom, "validFrom");
  if (has(b, "validTo")) request.validTo = optionalDate(b.validTo, "validTo");
  if (request.validFrom && request.validTo && request.validFrom > request.validTo) {
    throw new ValidationError("validFrom must be before validTo");
  }



  const touchesSomething =
    [
      "code", "name", "description", "version", "externalId", "validFrom", "validTo",
    ].some((k) => has(b, k));
  if (!touchesSomething) throw new ValidationError("Nothing to update");

  return request;
}

export class StructureEditController extends BaseController {
  private readonly service: StructureEditService;

  constructor(knex: Knex) {
    super();
    this.service = new StructureEditService(knex);
  }

  /** GET /api/structures/:id – the structure with all its fields (fills the edit form). */
  getStructure = async (req: Request, res: Response): Promise<void> => {
    try {
      this.success(res, await this.service.getStructure(parseStructureId(req.params.id)));
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };

  /**
   * PATCH /api/structures/:id   (F1.1.2)
   * body: { code?, name?, description?, version?, validFrom?, validTo?, agencyCode?, agencyName?,
   *         languageCode?, license?, externalId? }
   * Answers with the updated structure (same shape as GET /api/structures/:id).
   */
  editStructure = async (req: Request, res: Response): Promise<void> => {
    try {
      const input = parseEditStructureBody(req.params.id, req.body, req.user?.id ?? null);
      this.success(res, await this.service.editStructure(input), "Structure updated");
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };
}
