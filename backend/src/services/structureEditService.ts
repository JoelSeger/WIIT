import { Knex } from "knex";
import { Structure } from "../models/structure/structure";
import { Node } from "../models/node/node";
import { StructureRepository } from "../repos/structureRepository";
import { NodeRepository } from "../repos/nodeRepository";
import { ChangeLogRepository } from "../repos/changeLogRepository";

export class StructureEditService {

  private readonly structure: StructureRepository;
  private readonly node: NodeRepository;
  private readonly changelog: ChangeLogRepository;

  constructor(private readonly knex: Knex) {
    this.structure = new StructureRepository(knex);
    this.node = new NodeRepository(knex);
    this.changelog = new ChangeLogRepository(knex);
  }

  async flipPublished(id: number, userId: number): Promise<{
     parent: Structure,
     children: Node[]
   }> {
     return await this.knex.transaction(async (trx) => {

       const structure = await this.structure.flipPublished(id);

       const nodes = await this.node.flipPublishedByStructure(structure.id, structure.isPublished)

       await this.changelog.record({
         entityType: "node",
         entityId: structure.id,
         structureId: structure.id,
         action: structure.isPublished ? "publish" : "unpublish",
         oldValue: (!structure.isPublished!).toString(),
         newValue: structure.isPublished!.toString(),
         comment: "Changed the published status",
         changedBy: userId,
       });

       return { parent: structure, children: nodes };
     })
   }
}
