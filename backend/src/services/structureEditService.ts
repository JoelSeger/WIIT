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

  private async flipStructure(id: number): Promise<Structure> {
    return await this.structure.flipPublished(id);
  }

  async flipPublished(id: number): Promise<{
    parent: Structure,
    children: Node[]
  }> {
    return await this.knex.transaction(async (trx) => {

      const structure = await this.structure.flipPublished(id);

      const nodes = await this.node.findByStructure(id);

      if (!nodes || nodes.length == 0) {
        return { parent: structure, children: [] };
      }
    })
  }
}
