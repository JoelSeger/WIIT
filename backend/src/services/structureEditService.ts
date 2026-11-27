import { Structure } from "../models/structure/structure";
import { Node } from "../models/node/node";
import { UnitOfWork } from "../config/db";

export class StructureEditService {

  constructor(private readonly uow: UnitOfWork) { }

  async flipPublished(id: number, userId: number): Promise<{
     parent: Structure,
     children: Node[]
   }> {
     return await this.uow.run(async (repos) => {

       const structure = await repos.structures.flipPublished(id);

       const nodes = await repos.nodes.flipPublishedByStructure(structure.id, structure.isPublished)

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
