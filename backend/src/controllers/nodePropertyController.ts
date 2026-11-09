import type { Request, Response } from "express";
import type { Knex } from "knex";
import { BaseController } from "./baseController";
import { NodePropertyService } from "../services/nodePropertyService";
import { NodeActivityService } from "../services/nodeActivityService";
import { NodeEditService } from "../services/nodeEditService";
import { ValidationError } from "../services/errorService";
import { isPositiveInt, optionalDate, optionalString } from "./requestParsers";
import type { ActivityInput, PropertyValueInput } from "../types/node.properties.types";
import type { EditNodeRequest } from "../types/nodeEdit.types";

const has = (b: Record<string, unknown>, key: string): boolean => b[key] !== undefined;

/** rowVersion is an 8-byte SQL Server rowversion, sent as base64 (see NodeHeader.rowVersion). */
function parseRowVersion(v: unknown): Buffer | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") throw new ValidationError("rowVersion must be a string");
  const buf = Buffer.from(v, "base64");
  if (buf.length !== 8) throw new ValidationError("rowVersion is not valid");
  return buf;
}

/**
 * Validates the request body of PATCH /api/nodes/:id and returns a typed request.
 * Throws ValidationError. updatedBy is taken from the logged-in user only.
 */
export function parseEditNodeBody(nodeId: unknown, body: unknown, userId: number | null): EditNodeRequest {
  if (!isPositiveInt(nodeId)) throw new ValidationError("A valid node id is required");
  const b = (body ?? {}) as Record<string, unknown>;
  const request: EditNodeRequest = { nodeId, updatedBy: userId };

  if (has(b, "title")) {
    if (typeof b.title !== "string" || b.title.trim() === "") throw new ValidationError("title cannot be empty");
    if (b.title.trim().length > 500) throw new ValidationError("title must be at most 500 characters");
    request.title = b.title.trim();
  }
  if (has(b, "referenceCode")) request.referenceCode = optionalString(b.referenceCode, "referenceCode", 100);
  if (has(b, "previousReferenceCode")) {
    request.previousReferenceCode = optionalString(b.previousReferenceCode, "previousReferenceCode", 100);
  }
  if (has(b, "description")) request.description = optionalString(b.description, "description", 10000);
  if (has(b, "validFrom")) request.validFrom = optionalDate(b.validFrom, "validFrom");
  if (has(b, "validTo")) request.validTo = optionalDate(b.validTo, "validTo");
  if (request.validFrom && request.validTo && request.validFrom > request.validTo) {
    throw new ValidationError("validFrom must be before validTo");
  }

  if (b.properties !== undefined && b.properties !== null) {
    if (!Array.isArray(b.properties)) throw new ValidationError("properties must be a list");
    request.properties = b.properties.map((p: unknown, i: number) => {
      const item = p as Record<string, unknown>;
      if (!item || typeof item.key !== "string" || item.key.trim() === "") {
        throw new ValidationError(`properties[${i}].key is required`);
      }
      return item as unknown as PropertyValueInput;
    });
  }

  request.expectedRowVersion = parseRowVersion(b.rowVersion);

  const touchesSomething =
    ["title", "referenceCode", "previousReferenceCode", "description", "validFrom", "validTo"].some((k) => has(b, k)) ||
    (request.properties?.length ?? 0) > 0;
  if (!touchesSomething) throw new ValidationError("Nothing to update");

  return request;
}

export class NodePropertyController extends BaseController {
  private readonly properties: NodePropertyService;
  private readonly activities: NodeActivityService;
  private readonly editing: NodeEditService;

  constructor(knex: Knex) {
    super();
    this.properties = new NodePropertyService(knex);
    this.activities = new NodeActivityService(knex);
    this.editing = new NodeEditService(knex);
  }

  /**
   * PATCH /api/nodes/:id   (F3.2)
   * body: { title?, referenceCode?, previousReferenceCode?, validFrom?, validTo?, description?,
   *         properties?: [ { key, value, rowIndex?, isOwn?, publishedText? } ], rowVersion? }
   * Answers with the updated form of the node (same shape as GET /api/nodes/:id/form).
   */
  editNode = async (req: Request, res: Response): Promise<void> => {
    try {
      const input = parseEditNodeBody(Number(req.params.id), req.body, req.user?.id ?? null);
      this.success(res, await this.editing.editNode(input), "Node updated");
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };

  /** GET /api/nodes/:id/form */
  getForm = async (req: Request, res: Response): Promise<void> => {
    try {
      this.success(res, await this.properties.getForm(this.nodeId(req)));
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };

  /** PUT /api/nodes/:id/properties   body: { values: [ { key, value, rowIndex?, isOwn?, publishedText? } ] } */
  saveProperties = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = this.nodeId(req);
      const values = (req.body as { values?: unknown })?.values;
      if (!Array.isArray(values)) throw new ValidationError("Body must be { values: [...] }");
      values.forEach((v, i) => {
        if (!v || typeof (v as PropertyValueInput).key !== "string") {
          throw new ValidationError(`values[${i}].key is required`);
        }
      });
      this.success(
        res,
        await this.properties.saveValues(id, values as PropertyValueInput[], req.user?.id ?? null),
        "Values saved",
      );
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };

  /** GET /api/nodes/:id/activities */
  getActivities = async (req: Request, res: Response): Promise<void> => {
    try {
      this.success(res, await this.activities.list(this.nodeId(req)));
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };

  /** PUT /api/nodes/:id/activities   body: { activities: [ { name, description?, handlingstypNodeIds?, structureUnitNodeId?, structureUnitText? } ] } */
  saveActivities = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = this.nodeId(req);
      const list = (req.body as { activities?: unknown })?.activities;
      if (!Array.isArray(list)) throw new ValidationError("Body must be { activities: [...] }");
      list.forEach((a, i) => {
        const item = a as ActivityInput;
        if (!item || typeof item.name !== "string") throw new ValidationError(`activities[${i}].name is required`);
        if (item.handlingstypNodeIds !== undefined && !Array.isArray(item.handlingstypNodeIds)) {
          throw new ValidationError(`activities[${i}].handlingstypNodeIds must be a list`);
        }
      });
      this.success(res, await this.activities.replace(id, list as ActivityInput[]), "Activities saved");
    } catch (err: unknown) {
      this.handleError(res, err);
    }
  };

  private nodeId(req: Request): number {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ValidationError("A valid node id is required");
    return id;
  }
}
