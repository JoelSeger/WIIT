import type { Knex } from "knex";
import { createRepositories, type Repositories } from "../repos/repositories";
import type { ActivityDto, ActivityInput } from "../types/node.properties.types";
import { NotFoundError, ValidationError } from "./errorService";
import { UnitOfWork } from "../config/db";

/*
 * Which node types have the Aktiviteter tab is data: node_types.has_activities (migration 012).
 *
 * The two codes below are what an activity IS in Klara, not rules an archivist changes:
 * an activity ticks handlingstyper and may refer to a strukturenhet. They stay as constants
 * until fields and tabs become data (F3.7/F3.8).
 */

/** The checklist of an activity: handlingstyper somewhere below this node. */
const CHECKLIST_NODE_TYPE = "handlingstyp";

/** "Hänvisning till strukturenhet" must point at a node of this type. */
const STRUCTURE_UNIT_NODE_TYPE = "strukturenhet";

export type NodeActivityRepos = Pick<Repositories, "nodes" | "nodeTypes" | "nodeActivities">;

export class NodeActivityService {
    constructor(private readonly uow: UnitOfWork) { }

  async list(nodeId: number): Promise<ActivityDto[]> {
      return this.buildList(this.uow.repos, nodeId);
  }

  async buildList(repos: NodeActivityRepos, nodeId: number): Promise<ActivityDto[]> {
    const node = await repos.nodes.findById(nodeId);
    if (!node) throw new NotFoundError(`Node ${nodeId} was not found`);

    const activities = await repos.nodeActivities.findByNodeId(nodeId);
    const checklist = await repos.nodeActivities.findHandlingstypIds(activities.map((a) => a.id));

    return activities.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      sortOrder: a.sortOrder,
      handlingstypNodeIds: checklist.get(a.id) ?? [],
      structureUnitNodeId: a.structureUnitNodeId ?? null,
      structureUnitText: a.structureUnitText ?? null,
    }));
  }

  /** Replaces the whole activity list of a node. The order of the array becomes the sort order. */
  async replace(nodeId: number, inputs: ActivityInput[]): Promise<ActivityDto[]> {
    await this.uow.run(async (repos) => {
      const node = await repos.nodes.findById(nodeId);
      if (!node) throw new NotFoundError(`Node ${nodeId} was not found`);

      const nodeType = await repos.nodeTypes.findOne(node.nodeTypeId);
      if (!nodeType || !nodeType.hasActivities) {
        throw new ValidationError("This node type has no activities");
      }

      // Every ticked node must be a handlingstyp somewhere below this node. The depth is not
      // fixed: it works with a handlingsslag level in between (process - HS - HT) and without
      // one (process - HT), so the tree can change shape without this check breaking.
      const wanted = [...new Set(inputs.flatMap((a) => a.handlingstypNodeIds ?? []))];
      if (wanted.length > 0) {
        const ofRightType: { id: number }[] = await repos.nodes.findStructureUnitIds(wanted, CHECKLIST_NODE_TYPE);
        const below = await repos.nodes.filterDescendantsOf(nodeId, ofRightType.map((r) => r.id));
        if (below.size !== wanted.length) {
          throw new ValidationError(
            `The checklist may only contain ${CHECKLIST_NODE_TYPE} nodes that belong to this node`,
          );
        }
      }

      // Every strukturenhet reference must be a node of type 'strukturenhet'.
      const units = [...new Set(inputs.map((a) => a.structureUnitNodeId).filter((id): id is number => !!id))];
      if (units.length > 0) {
          const found = await repos.nodes.findStructureUnitIds(units, STRUCTURE_UNIT_NODE_TYPE);
        if (found.length !== units.length) {
          throw new ValidationError(`structureUnitNodeId must be a ${STRUCTURE_UNIT_NODE_TYPE} node`);
        }
      }


      await repos.nodeActivities.deleteByNodeId(nodeId);

      for (const [index, input] of inputs.entries()) {
        const name = input.name?.trim();
        if (!name) throw new ValidationError("Every activity needs a name");

        const created = await repos.nodeActivities.create({
          nodeId,
          name,
          description: input.description?.trim() || null,
          structureUnitNodeId: input.structureUnitNodeId ?? null,
          structureUnitText: input.structureUnitText?.trim() || null,
          sortOrder: index,
        });
        await repos.nodeActivities.addHandlingstyp(created.id, [...new Set(input.handlingstypNodeIds ?? [])]);
      }
    });

    return this.list(nodeId);
  }
}
