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
       //ADD CHANGELOG FOR ALL CHILDREN TOO!!
       await repos.changeLog.record({
         entityType: "structure",
         entityId: structure.id,
         structureId: structure.id,
         action: structure.isPublished ? "publish" : "unpublish",
         oldValue: JSON.stringify((!structure.isPublished!)),
         newValue: JSON.stringify(structure.isPublished!),
         comment: "Changed the published status",
         changedBy: userId,
       });

       for (const node of nodes) {
           await repos.changeLog.record({
               entityType: "node",
               entityId: node.id,
               structureId: node.id,
               action: node.isPublished ? "publish" : "unpublish",
               oldValue: JSON.stringify((!node.isPublished!)),
               newValue: JSON.stringify(node.isPublished!),
               comment: "Changed the published status",
               changedBy: userId,
           });
       }

       return { parent: structure, children: nodes };
     })
   }
}
