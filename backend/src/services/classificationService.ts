import { NodeRepository } from "../repos/node/nodeRepository";
import { NodeTypeRepository } from "../repos/node/nodeTypeRepository";
import { StructureRepository } from "../repos/structureRepository";
import { Node } from "../models/node/node";
import { ChangeLog } from "../models/changeLog";
import { ChangeLogRepository } from "../repos/changeLogRepository";
import { Tx } from "../db/unitOfWork";
import { Structure } from "../models/structure/structure";
import { toTree } from "../helper/nodeApiSupport";
import { PropertyDefinitionRepository } from "../repos/propertyDefinitionRepository";
import { NodeService } from "./nodeService";
import { NodeValue, TreeNode } from "../models/node/treeNode";
import { NodePropertyValuesRepository } from "../repos/node/nodePropertyValuesRepository";

// NEED TO DECIDE IF THIS IS HOW WE DO IT!
const CLASSIFICATION = 'klassificering'

export class ClassificationService {

  nodeService: NodeService;

  constructor(
    private structures: StructureRepository,
    private nodes: NodeRepository,
    private types: NodeTypeRepository,
    private property: PropertyDefinitionRepository,
    private values: NodePropertyValuesRepository,
    private logger: ChangeLogRepository,
  ) {
    this.nodeService = new NodeService(nodes, types, property, structures);
  }

  async tree(): Promise<Array<{ structure: Structure; nodes: TreeNode[] }>> {
    const structures = await this.structures.findByType(CLASSIFICATION);
    if (structures.length === 0) return [];

    const rows = await this.nodes.findByStructures(structures.map(s => s.id));
    if (rows.length === 0) {
      return structures.map(structure => ({ structure, nodes: [] }));
    }

    // --- Fetch node types and raw values in parallel (independent of each other) ---
    const [nodeTypes, rawValues] = await Promise.all([
      this.types.findByIds([...new Set(rows.map(r => r.nodeTypeId))]),
      this.values.findByNodeIds(rows.map(r => r.id)),
    ]);
    const nodeTypeById = new Map(nodeTypes.map(t => [t.id, t]));

    // --- Definitions depend on the values we just fetched ---
    const definitions = await this.property.findByIds([
      ...new Set(rawValues.map(v => v.propertyDefinitionId)),
    ]);
    const definitionById = new Map(definitions.map(d => [d.id, d]));

    // --- Group values by node, attaching each value's definition ---
    const valuesByNode = new Map<number, NodeValue[]>();
    for (const value of rawValues) {
      const definition = definitionById.get(value.propertyDefinitionId);
      if (!definition) {
        throw new Error(`Missing PropertyDefinition for value ${value.id}`);
      }
      const enriched = { ...value, definition } as NodeValue;
      const list = valuesByNode.get(value.nodeId);
      if (list) list.push(enriched); else valuesByNode.set(value.nodeId, [enriched]);
    }

    // --- Group flat nodes by structure ---
    type FlatNode = Omit<TreeNode, "children">;
    const nodesByStructure = new Map<number, FlatNode[]>();

    for (const row of rows) {
      const nodeType = nodeTypeById.get(row.nodeTypeId);
      if (!nodeType) {
        throw new Error(`Missing NodeType for node ${row.id} (typeId: ${row.nodeTypeId})`);
      }

      const { rowVersion: _rowVersion, ...nodeData } = row;
      const flat: FlatNode = {
        ...nodeData,
        nodeType,
        values: valuesByNode.get(row.id) ?? [],
      };

      const list = nodesByStructure.get(row.structureId);
      if (list) list.push(flat); else nodesByStructure.set(row.structureId, [flat]);
    }

    // --- Assemble final result ---
    const resultTree = structures.map(structure => ({
      structure,
      nodes: toTree(nodesByStructure.get(structure.id) ?? []),
    }));
    return resultTree;
  }

  async getNode(id: number): Promise<Node> {
    const nodeType = await this.types.findById(id);
    if (!nodeType) throw new Error(`Node with id: ${id} not found.`);
    //TODO: FIX `classification` SO IT MATCHES WITH THE REST OF THE CODE ONCE IT's DONE!!!
    if (nodeType.structureType != CLASSIFICATION) throw new Error(`Node with id: ${id} is not a classification node. `);
    const node = await this.nodes.findById(id);
    if (!node) throw new Error(`Node with id: ${id} was not found.`);
    return node;
  }

  /** COMMENTED OUT UNTIL LILAS IS DONE WITH HER WORK
  async createNode(input: CreateClassificationNode, userId: number | null): Promise<Node> {
    //MAYBE ADD DTOS FOR CREATING/UPDATING NODES??
    throw new Error(`NOT IMPLEMENTED YET! WAITING FOR LILAS WORK!`)
  }

  async updateNode(id: number, changes: updateClassificationNode, userId: number | null): Promise<Node> {
    //MAYBE ADD DTOS FOR CREATING/UPDATING NODES??
    throw new Error(`NOT IMPLEMENTED YET!`)
  }
  */
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
