import type { Request, Response } from "express";
import type { Knex } from "knex";
import { BaseController } from "./baseController";
import { NodePropertyService } from "../services/nodePropertyService";
import { NodeActivityService } from "../services/nodeActivityService";
import { ValidationError } from "../services/errorService";
import type { ActivityInput, PropertyValueInput } from "../types/node.properties.types";

export class NodePropertyController extends BaseController {
  private readonly properties: NodePropertyService;
  private readonly activities: NodeActivityService;

  constructor(knex: Knex) {
    super();
    this.properties = new NodePropertyService(knex);
    this.activities = new NodeActivityService(knex);
  }

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
