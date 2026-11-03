import { NodeRepository } from "../repos/nodeRepository";
import { NodeTypeRepository } from "../repos/nodeTypeRepository";
import { StructureRepository } from "../repos/structureRepository";
import { NodeService } from "./nodeService";
import { Node } from "../models/node/node";
import { ChangeLog } from "../models/changeLog";
import { ChangeLogRepository } from "../repos/changeLogRepository";
import { Tx } from "../db/unitOfWork";

export class ClassificationService {
  constructor(
    private structures: StructureRepository,
    private nodes: NodeRepository,
    private types: NodeTypeRepository,
    private nodeService: NodeService,
    private logger: ChangeLogRepository,
  ) { }

  async tree(): Promise<Array<{ structure: Structure; nodes: TreeNode[] }>> {
    const tree = [];


  }

  async getNode(id: number): Promise<Node> {
    const nodeType = await this.types.findById(id);
    if (!nodeType) throw new Error(`Node with id: ${id} not found.`);
    //TODO: FIX THIS SO IT MATCHES WITH THE REST OF THE CODE ONCE IT's DONE!!!
    if (nodeType.structureType != `classfication`) throw new Error(`Node with id: ${id} is not a classification node. `);
    const node = await this.nodes.findById(id);
    if (!node) throw new Error(`Node with id: ${id} was not found.`);
    return node;
  }

  async createNode(input: CreateClassificationNode, userId: number | null): Promise<Node> {
    //MAYBE ADD DTOS FOR CREATING/UPDATING NODES??
    throw new Error(`NOT IMPLEMENTED YET! WAITING FOR LILAS WORK!`)
  }

  async updateNode(id: number, changes: NodeChanges, userId: number | null): Promise<Node> {
    //MAYBE ADD DTOS FOR CREATING/UPDATING NODES??
    throw new Error(`NOT IMPLEMENTED YET!`)
  }

  async deleteNode(id: number, userId: number | null, trx: Tx): Promise<Node> {
    const node = await this.getNode(id);
    type Entry = Omit<ChangeLog, "id" | "changedAt">
    const entry: Entry = {
      comment: null,
      entityType: "",
      entityId: node.nodeTypeId,
      structureId: node.structureId,
      action: "Deleted",
      oldValue: null,
      newValue: null,
      changedBy: userId,
    }
    this.logger.record(entry, trx)
    this.nodeService.delete(id, trx)
    return node;
  }
}
