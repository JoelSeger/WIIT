import type { Knex } from "knex";
import { NodeRepository } from "../repos/nodeRepository";
import { NodeActivityRepository } from "../repos/nodeActivityRepository";
import { NodeRelationRepository } from "../repos/nodeRelationRepository";
import { ChangeLogRepository } from "../repos/changeLogRepository";
import { ConflictError, NotFoundError, isForeignKeyViolation } from "./errorService";
import type { DeleteNodeRequest, DeletedNode } from "../types/nodeDelete.types";

/**
 * F3.1 – delete a node that has no children.
 *
 * One delete = one transaction:
 *   1. the node must exist, and must not have children (409 otherwise)
 *   2. its activities are removed (their checklist rows go with them – ON DELETE CASCADE)
 *   3. its relations (förvaras i …) are removed – those foreign keys are NO ACTION (migration 004)
 *   4. if another node still uses it as strukturenhet / handlingstyp: 409, nothing is deleted
 *   5. the node is deleted (its property values go with it – ON DELETE CASCADE)
 *   6. a change_log row (action 'delete') keeps what was removed
 * If any step fails, nothing is deleted.
 */
export class NodeDeleteService {
  constructor(private readonly knex: Knex) {}

  async deleteNode(request: DeleteNodeRequest): Promise<DeletedNode> {
    try {
      return await this.knex.transaction(async (trx) => {
        const nodes = new NodeRepository(this.knex, trx);
        const node = await nodes.findById(request.nodeId);
        if (!node) throw new NotFoundError(`Node ${request.nodeId} was not found`);

        if (await nodes.hasChildren(node.id)) {
          throw new ConflictError("The node has children and cannot be deleted. Delete or move the children first");
        }

        await new NodeActivityRepository(this.knex, trx).deleteByNodeId(node.id);
        const relations = await new NodeRelationRepository(this.knex, trx).deleteByNodeId(node.id);

        if (await new NodeActivityRepository(this.knex, trx).isReferenced(node.id)) {
          throw new ConflictError(
            "The node is used by an activity (as strukturenhet or handlingstyp) and cannot be deleted",
          );
        }

        const deleted = await nodes.delete(node.id);
        if (!deleted) throw new NotFoundError(`Node ${request.nodeId} was not found`);

        await new ChangeLogRepository(this.knex, trx).logNodeDelete({
          nodeId: node.id,
          structureId: node.structureId,
          oldValue: {
            parentId: node.parentId,
            nodeTypeId: node.nodeTypeId,
            referenceCode: node.referenceCode,
            previousReferenceCode: node.previousReferenceCode,
            title: node.title,
            sortOrder: node.sortOrder,
            isPublished: node.isPublished,
            validFrom: node.validFrom,
            validTo: node.validTo,
            description: node.description,
            removedRelations: relations.map((r) => ({
              id: r.id,
              relationTypeId: r.relationTypeId,
              fromNodeId: r.fromNodeId,
              toNodeId: r.toNodeId,
            })),
          },
          changedBy: request.deletedBy,
        });

        return { id: node.id, structureId: node.structureId, title: node.title };
      });
    } catch (err) {
      // Someone added a child (or a reference) between our checks and the delete: the database
      // refuses, and that is the same answer as the checks above.
      if (isForeignKeyViolation(err)) {
        throw new ConflictError("The node is still in use and cannot be deleted");
      }
      throw err;
    }
  }
}
