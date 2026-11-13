import type { Knex } from "knex";
import { NodeRepository } from "../repos/nodeRepository";
import { NodeTypeRepository } from "../repos/nodeTypeRepository";
import { NodeActivityRepository } from "../repos/nodeActivityRepository";
import type { ActivityDto, ActivityInput } from "../types/node.properties.types";
import { NotFoundError, ValidationError } from "./errorService";

/** Node types that have the Aktiviteter tab. */
const TYPES_WITH_ACTIVITIES = ["process"];

/** The checklist of an activity: handlingstyper that belong to this process (via its handlingsslag). */
const CHECKLIST_NODE_TYPE = "handlingstyp";

/** "Hänvisning till strukturenhet" must point at a node of this type. */
const STRUCTURE_UNIT_NODE_TYPE = "strukturenhet";

export class NodeActivityService {
  constructor(private readonly knex: Knex) {}

  async list(nodeId: number): Promise<ActivityDto[]> {
    const node = await new NodeRepository(this.knex).findById(nodeId);
    if (!node) throw new NotFoundError(`Node ${nodeId} was not found`);

    const repo = new NodeActivityRepository(this.knex);
    const activities = await repo.findByNodeId(nodeId);
    const checklist = await repo.findHandlingstypIds(activities.map((a) => a.id));

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
    await this.knex.transaction(async (trx) => {
      const node = await new NodeRepository(this.knex, trx).findById(nodeId);
      if (!node) throw new NotFoundError(`Node ${nodeId} was not found`);

      const nodeType = await new NodeTypeRepository(this.knex, trx).findOne(node.nodeTypeId);
      if (!nodeType || !TYPES_WITH_ACTIVITIES.includes(nodeType.code)) {
        throw new ValidationError("This node type has no activities");
      }

      // Every ticked handlingstyp must be a handlingstyp two levels below this process.
      const wanted = [...new Set(inputs.flatMap((a) => a.handlingstypNodeIds ?? []))];
      if (wanted.length > 0) {
        const found = await trx("nodes as n")
          .join("node_types as t", "t.id", "n.node_type_id")
          .join("nodes as hs", "hs.id", "n.parent_id")
          .where("hs.parent_id", nodeId)
          .where("t.code", CHECKLIST_NODE_TYPE)
          .whereIn("n.id", wanted)
          .select("n.id");
        if (found.length !== wanted.length) {
          throw new ValidationError(
            `The checklist may only contain ${CHECKLIST_NODE_TYPE} nodes that belong to this process`,
          );
        }
      }

      // Every strukturenhet reference must be a node of type 'strukturenhet'.
      const units = [...new Set(inputs.map((a) => a.structureUnitNodeId).filter((id): id is number => !!id))];
      if (units.length > 0) {
        const found = await trx("nodes as n")
          .join("node_types as t", "t.id", "n.node_type_id")
          .where("t.code", STRUCTURE_UNIT_NODE_TYPE)
          .whereIn("n.id", units)
          .select("n.id");
        if (found.length !== units.length) {
          throw new ValidationError(`structureUnitNodeId must be a ${STRUCTURE_UNIT_NODE_TYPE} node`);
        }
      }

      const repo = new NodeActivityRepository(this.knex, trx);
      await repo.deleteByNodeId(nodeId);

      for (const [index, input] of inputs.entries()) {
        const name = input.name?.trim();
        if (!name) throw new ValidationError("Every activity needs a name");

        const created = await repo.create({
          nodeId,
          name,
          description: input.description?.trim() || null,
          structureUnitNodeId: input.structureUnitNodeId ?? null,
          structureUnitText: input.structureUnitText?.trim() || null,
          sortOrder: index,
        });
        await repo.addHandlingstyp(created.id, [...new Set(input.handlingstypNodeIds ?? [])]);
      }
    });

    return this.list(nodeId);
  }
}
