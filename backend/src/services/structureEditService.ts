import { Structure } from "../models/structure/structure";
import { Node } from "../models/node/node";
import { UnitOfWork } from "../config/db";

export class StructureEditService {

  constructor(private readonly uow: UnitOfWork) { }

  async flipPublished(id: number): Promise<{
     parent: Structure,
     children: Node[]
   }> {
     return await this.uow.run(async (repos) => {

       const structure = await repos.structures.flipPublished(id);

       const nodes = await repos.nodes.flipPublishedByStructure(structure.id, structure.isPublished)

       return { parent: structure, children: nodes };
     })
   }
}
