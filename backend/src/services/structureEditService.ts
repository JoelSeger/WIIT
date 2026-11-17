import { Knex } from "knex";
import { Structure } from "../models/structure/structure";
import { Node } from "../models/node/node";
import { StructureRepository } from "../repos/structureRepository";
import { NodeRepository } from "../repos/nodeRepository";

export class StructureEditService {

  private readonly structure: StructureRepository;
  private readonly node: NodeRepository;

  constructor(private readonly knex: Knex) {
    this.structure = new StructureRepository(knex);
    this.node = new NodeRepository(knex);
  }

  async flipPublished(id: number): Promise<{
     parent: Structure,
     children: Node[]
   }> {
     return await this.knex.transaction(async (trx) => {

       const structure = await this.structure.flipPublished(id);

       const nodes = await this.node.flipPublishedByStructure(structure.id, structure.isPublished)

       return { parent: structure, children: nodes };
     })
   }
}
