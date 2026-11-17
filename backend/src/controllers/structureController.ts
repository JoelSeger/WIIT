import { Knex } from "knex";
import { StructureEditService } from "../services/structureEditService";
import { BaseController } from "./baseController";

export class StructureController extends BaseController {
    constructor(private readonly service: StructureEditService) {
        super();
    }
    // PUT /api/structures/publish
    flipPublished = async (id:number) => {
        return await this.service.flipPublished(id)
    }
}
