import type { Knex } from "knex";
import { NodeRepository } from "../repos/nodeRepository";
import { NodeTypeRepository } from "../repos/nodeTypeRepository";
import { StructureRepository } from "../repos/structureRepository";
import type { Node } from "../models/node/node";
import type { PropertyValueInput } from "../types/node.properties.types";
import { NodePropertyService } from "./nodePropertyService";
import { ConflictError, NotFoundError, ValidationError } from "./errorService";

export interface CreateNodeRequest {
  structureId: number;
  parentId: number | null;
  nodeTypeCode: string;
  referenceCode: string | null;
  previousReferenceCode: string | null;
  title: string;
  sortOrder: number;
  description: string | null;
  validFrom: string | null;
  validTo: string | null;
  properties: PropertyValueInput[];
  /** Taken from the logged-in user by the controller – never from the request body. */
  createdBy: number | null;
}

/**
 * Node types that may be a root (no parent), per structure type.
 * A verksamhetsområde can be a root in a klassificering structure only.
 */
const ROOT_TYPES: Record<string, string[]> = {
  klassificering: ["verksamhetsomrade"],
  forvaring: ["strukturenhet"],
};

export class NodeCreationService {
  constructor(private readonly knex: Knex) {}

  async createNode(data: CreateNodeRequest): Promise<Node> {
    return this.knex.transaction(async (trx) => {
      const structure = await new StructureRepository(this.knex, trx).findById(data.structureId);
      if (!structure) throw new NotFoundError(`Structure ${data.structureId} was not found`);

      const nodeTypeRepository = new NodeTypeRepository(this.knex, trx);
      const nodeRepository = new NodeRepository(this.knex, trx);

      const childType = await nodeTypeRepository.findByCode(data.nodeTypeCode);
      if (!childType) {
        throw new ValidationError(`Node type '${data.nodeTypeCode}' does not exist or is inactive`);
      }

      // The node type must belong to the same kind of tree as the structure.
      if (childType.structureType !== structure.structureType) {
        throw new ValidationError(
          `Node type '${data.nodeTypeCode}' belongs to ${childType.structureType} structures, ` +
          `but structure ${structure.id} is ${structure.structureType}`,
        );
      }

      if (data.parentId === null) {
        const allowedRoots = ROOT_TYPES[structure.structureType] ?? [];
        if (!allowedRoots.includes(childType.code)) {
          throw new ValidationError(
            `Node type '${data.nodeTypeCode}' is not allowed as a root node in a ${structure.structureType} structure`,
          );
        }
      } else {
        const parent = await nodeRepository.findById(data.parentId);
        if (!parent) throw new NotFoundError(`Parent node ${data.parentId} was not found`);
        if (parent.structureId !== data.structureId) {
          throw new ValidationError("Parent node must belong to the same structure");
        }
        const isAllowed = await nodeTypeRepository.isAllowedChild(parent.nodeTypeId, childType.id);
        if (!isAllowed) {
          throw new ValidationError(`Node type '${data.nodeTypeCode}' is not allowed under this parent`);
        }
      }

      if (data.referenceCode) {
        const exists = await nodeRepository.existsByStructureParentAndReferenceCode(
          data.structureId,
          data.parentId,
          data.referenceCode,
        );
        if (exists) {
          throw new ConflictError(
            `A node with reference code '${data.referenceCode}' already exists under this parent`,
          );
        }
      }

      const node = await nodeRepository.createNode({
        structureId: data.structureId,
        parentId: data.parentId,
        nodeTypeId: childType.id,
        referenceCode: data.referenceCode,
        previousReferenceCode: data.previousReferenceCode,
        title: data.title,
        sortOrder: data.sortOrder,
        description: data.description,
        validFrom: data.validFrom,
        validTo: data.validTo,
        createdBy: data.createdBy,
      });

      // Attribute values in the same transaction: an invalid value means no node either.
      await new NodePropertyService(this.knex).saveValuesInTransaction(
        trx,
        node,
        data.properties,
        data.createdBy,
        true,
      );

      return node;
    });
  }
}
