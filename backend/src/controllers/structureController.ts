import type { Response, Request } from 'express';
import { StructureEditService } from "../services/structureEditService";
import { BaseController } from "./baseController";
import { NotFoundError } from '../services/errorService';

export class StructureController extends BaseController {
    constructor(private readonly service: StructureEditService) {
        super();
    }
    // PUT /api/structures/:id/publish
    flipPublished = async (req: Request, res: Response): Promise<void> => {
        try {
            if (!req.user) this.unauthorized(res);
            if (req.user == undefined) throw new NotFoundError("User not found")
            const id = this.nodeId(req);
            const data = await this.service.flipPublished(id, req.user.id);
            this.success(res, data);
        } catch (err: any) {
            this.handleError(res, err);
        }

    }
}
