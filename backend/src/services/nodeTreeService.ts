import type { Node } from "../models/node/node";
import type { NodeValue, TreeNode } from "../models/node/treeNode";
import type { NodePropertyValues } from "../models/node/nodePropertyValues";
import type { NodeRepository } from "../repos/nodeRepository";
import type { NodeTypeRepository } from "../repos/nodeTypeRepository";
import type { PropertyDefinitionRepository } from "../repos/propertyDefinitionRepository";
import type { StructureRepository } from "../repos/structureRepository";

/** sort_order for a value whose field is not linked to the node type: after the linked fields. */
const UNPLACED_ORDER = 1000;

export class NodeTreeService {
  constructor(
    private readonly nodes: NodeRepository,
    private readonly nodeTypes: NodeTypeRepository,
    private readonly definitions: PropertyDefinitionRepository,
    private readonly structures: StructureRepository,
  ) {}

  /**
   * The whole tree of one structure.
   *
   * publicOnly = true is what the public site may show:
   *   - null if the structure is not published
   *   - unpublished nodes are dropped together with their whole branch
   *   - only values of fields with isPublic = true
   *
   * @returns null if the structure does not exist (or is hidden in public mode)
   */
  async getTree(structureId: number, publicOnly = false): Promise<TreeNode[] | null> {
    const structure = await this.structures.findById(structureId);
    if (!structure) return null;
    if (publicOnly && !structure.isPublished) return null;

    const nodes = await this.nodes.findByStructure(structureId);
    if (nodes.length === 0) return [];

    const values = await this.nodes.findValuesByStructure(structureId);

    const typeIds = [...new Set(nodes.map((n) => n.nodeTypeId))];
    const [types, placed] = await Promise.all([
      this.nodeTypes.findByIds(typeIds),
      this.definitions.findPlacedByNodeTypes(typeIds),
    ]);

    // Migration 013: a field can be on several node types, with its own order and label on each,
    // so a value is matched on (node type, field), not on the field alone.
    const typeOfNode = new Map(nodes.map((n) => [n.id, n.nodeTypeId]));
    const defFor = new Map(placed.map((d) => [`${d.nodeTypeId}:${d.id}`, d]));
    const keyOf = (v: NodePropertyValues) => `${typeOfNode.get(v.nodeId)}:${v.propertyDefinitionId}`;

    // A value whose field is not linked to the node's type (the link was removed later) is still
    // shown, after the linked fields. Migration 013 links every field that had values.
    const unplaced = [...new Set(values.filter((v) => !defFor.has(keyOf(v))).map((v) => v.propertyDefinitionId))];
    if (unplaced.length > 0) {
      const fields = new Map((await this.definitions.findByIds(unplaced)).map((f) => [f.id, f]));
      for (const v of values) {
        const field = fields.get(v.propertyDefinitionId);
        if (!field || defFor.has(keyOf(v))) continue;
        const nodeTypeId = typeOfNode.get(v.nodeId)!;
        defFor.set(keyOf(v), { ...field, nodeTypeId, tabKey: null, groupKey: null, sortOrder: UNPLACED_ORDER, isRequired: false });
      }
    }

    const valuesByNode = this.groupValues(values, (v) => defFor.get(keyOf(v)), publicOnly);
    const typeById = new Map(types.map((t) => [t.id, t]));

    const roots = this.nest(nodes, typeById, valuesByNode);
    return publicOnly ? this.prunePublic(roots) : roots;
  }

  /** Attaches each value to its field on the node's type, drops non-public fields in public mode, sorts by the node type's field order. */
  private groupValues(
    values: NodePropertyValues[],
    definitionOf: (v: NodePropertyValues) => NodeValue["definition"] | undefined,
    publicOnly: boolean,
  ): Map<number, NodeValue[]> {
    const byNode = new Map<number, NodeValue[]>();

    for (const v of values) {
      const definition = definitionOf(v);
      if (!definition) continue;
      if (publicOnly && !definition.isPublic) continue;   // OSL / GDPR

      const list = byNode.get(v.nodeId) ?? [];
      list.push({ ...v, definition });
      byNode.set(v.nodeId, list);
    }

    for (const list of byNode.values()) {
      list.sort((a, b) =>
        a.definition.sortOrder - b.definition.sortOrder
        || a.propertyDefinitionId - b.propertyDefinitionId
        || a.valueOrder - b.valueOrder);
    }
    return byNode;
  }

  /** Flat rows to a nested tree. Rows arrive ordered by sortOrder, so siblings stay in order. */
  private nest(
    nodes: Node[],
    typeById: Map<number, TreeNode["nodeType"]>,
    valuesByNode: Map<number, NodeValue[]>,
  ): TreeNode[] {
    const byId = new Map<number, TreeNode>();

    for (const n of nodes) {
      const { rowVersion: _rowVersion, ...rest } = n;
      byId.set(n.id, {
        ...rest,
        nodeType: typeById.get(n.nodeTypeId)!,
        values: valuesByNode.get(n.id) ?? [],
        children: [],
      });
    }

    const roots: TreeNode[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId == null ? null : byId.get(node.parentId);
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  /** Unpublished node = whole branch hidden, since children are only reachable through the parent. */
  private prunePublic(nodes: TreeNode[]): TreeNode[] {
    return nodes
      .filter((n) => Boolean(n.isPublished))   // MSSQL: boolean, SQLite: 0/1
      .map((n) => ({ ...n, children: this.prunePublic(n.children) }));
  }
}
