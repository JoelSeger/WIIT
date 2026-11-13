import type { Knex } from "knex";
import { NodeRepository } from "../repos/nodeRepository";
import { ChangeLogRepository } from "../repos/changeLogRepository";
import { NodePropertyService } from "./nodePropertyService";
import { ConflictError, NotFoundError, ValidationError } from "./errorService";
import type { Node } from "../models/node/node";
import type { NodeForm } from "../types/node.properties.types";
import type { EditNodeRequest, NodeAttributeChanges } from "../types/nodeEdit.types";

/** What is written to change_log: only the things that really changed, old and new. */
type Snapshot = Record<string, unknown>;

/**
 * F3.2 – edit the attributes of an existing node.
 *
 * One edit = one transaction:
 *   1. the columns of the node (title, referenceCode, validFrom …)
 *   2. the values of its property fields
 *   3. updated_at / updated_by (+ optimistic lock on row_version)
 *   4. a change_log row with old and new values
 * If any step fails, nothing is saved.
 *
 * What an edit can NOT change: the node type, the structure, the parent and the sort order
 * (moving a node is a separate function) and is_published (publishing is a separate function).
 */
export class NodeEditService {
  private readonly properties: NodePropertyService;

  constructor(private readonly knex: Knex) {
    this.properties = new NodePropertyService(knex);
  }

  async editNode(request: EditNodeRequest): Promise<NodeForm> {
    await this.knex.transaction(async (trx) => {
      const nodes = new NodeRepository(this.knex, trx);
      const node = await nodes.findById(request.nodeId);
      if (!node) throw new NotFoundError(`Node ${request.nodeId} was not found`);

      // --- 1. the node's own columns -------------------------------------------------------
      const { changes, oldValues, newValues } = this.diffColumns(node, request);
      await this.validateColumns(nodes, node, changes);

      // --- 2. the property values ----------------------------------------------------------
      const inputs = request.properties ?? [];
      const keys = [...new Set(inputs.map((i) => i.key))];
      const before = await this.properties.snapshotValues(trx, node, keys);
      await this.properties.saveValuesInTransaction(trx, node, inputs, request.updatedBy, false);
      const after = await this.properties.snapshotValues(trx, node, keys);

      const changedKeys = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
      if (changedKeys.length > 0) {
        oldValues.properties = Object.fromEntries(changedKeys.map((k) => [k, before[k]]));
        newValues.properties = Object.fromEntries(changedKeys.map((k) => [k, after[k]]));
      }

      // Nothing really changed: do not touch the node and do not write a log row.
      if (Object.keys(changes).length === 0 && changedKeys.length === 0) return;

      // --- 3. stamp the node, and make sure nobody else changed it meanwhile ----------------
      const updated = await nodes.updateAttributes(node.id, changes, request.updatedBy, request.expectedRowVersion);
      if (!updated) {
        // Throwing rolls back the property values saved above as well.
        throw new ConflictError("The node was changed by someone else. Reload it and try again");
      }

      // --- 4. traceability -----------------------------------------------------------------
      await new ChangeLogRepository(this.knex, trx).logNodeUpdate({
        nodeId: node.id,
        structureId: node.structureId,
        oldValue: oldValues,
        newValue: newValues,
        changedBy: request.updatedBy,
      });
    });

    return this.properties.getForm(request.nodeId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Compares what was sent with what is stored. Only real differences end up in `changes`. */
  private diffColumns(
    node: Node,
    request: EditNodeRequest,
  ): { changes: NodeAttributeChanges; oldValues: Snapshot; newValues: Snapshot } {
    const changes: NodeAttributeChanges = {};
    const oldValues: Snapshot = {};
    const newValues: Snapshot = {};

    const stored: Required<NodeAttributeChanges> = {
      title: node.title,
      referenceCode: node.referenceCode ?? null,
      previousReferenceCode: node.previousReferenceCode ?? null,
      validFrom: this.toDateString(node.validFrom),
      validTo: this.toDateString(node.validTo),
      description: node.description ?? null,
    };

    for (const field of Object.keys(stored) as (keyof NodeAttributeChanges)[]) {
      const sent = request[field];
      if (sent === undefined || sent === stored[field]) continue;
      (changes as Record<string, unknown>)[field] = sent;
      oldValues[field] = stored[field];
      newValues[field] = sent;
    }
    return { changes, oldValues, newValues };
  }

  /** Rules that depend on the stored node. Format checks were already done by the controller. */
  private async validateColumns(nodes: NodeRepository, node: Node, changes: NodeAttributeChanges): Promise<void> {
    // The date range is checked on the result: sending only validTo must still be <= stored validFrom.
    const validFrom = "validFrom" in changes ? changes.validFrom : this.toDateString(node.validFrom);
    const validTo = "validTo" in changes ? changes.validTo : this.toDateString(node.validTo);
    if (validFrom && validTo && validFrom > validTo) {
      throw new ValidationError("validFrom must be before validTo");
    }

    if (changes.referenceCode) {
      const taken = await nodes.existsReferenceCodeInStructure(node.structureId, changes.referenceCode, node.id);
      if (taken) {
        throw new ConflictError(`A node with reference code '${changes.referenceCode}' already exists in this structure`);
      }
    }
  }

  private toDateString(d: unknown): string | null {
    if (!d) return null;
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  }
}
