import type { Knex } from "knex";
import { createRepositories, type Repositories } from "../repos/repositories";
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

export type NodeCreationRepos = Pick<Repositories, "nodes" | "nodeTypes" | "structures">;

/** Only what this service calls on NodePropertyService – easy to fake in a test. */
export type NodeCreationProperties = Pick<NodePropertyService, "saveValuesInTransaction">;

export class NodeCreationService {
  constructor(
    private readonly knex: Knex,
    private readonly repos: NodeCreationRepos = createRepositories(knex),
    private readonly properties: NodeCreationProperties = new NodePropertyService(knex),
  ) {}

  async createNode(data: CreateNodeRequest): Promise<Node> {
    return this.knex.transaction(async (trx) => {
      const structure = await this.repos.structures(trx).findById(data.structureId);
      if (!structure) throw new NotFoundError(`Structure ${data.structureId} was not found`);

      const nodeTypeRepository = this.repos.nodeTypes(trx);
      const nodeRepository = this.repos.nodes(trx);

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
        // Which types may be a top node is data: node_types.can_be_root (migration 012).
        // In which kind of structure was checked above (the type's own structure_type).
        if (!childType.canBeRoot) {
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
      await this.properties.saveValuesInTransaction(
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
