import { Knex } from "knex";
import type { Response, Request } from 'express';
import { StructureEditService } from "../services/structureEditService";
import { BaseController } from "./baseController";

export class StructureController extends BaseController {
    constructor(private readonly service: StructureEditService) {
        super();
    }
    // PUT /api/structures/publish
    flipPublished = async (req: Request, res: Response): Promise<void> => {
        try {
            const id = this.nodeId(req);
            const data = await this.service.flipPublished(id);
            this.success(res, data);
        } catch (err: any) {
            this.handleError(res, err);
        }

    }
}
