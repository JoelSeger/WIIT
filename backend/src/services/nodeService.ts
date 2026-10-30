import type { Knex } from "knex";
import { NodeRepository } from "../repos/nodeRepository";
import { NodeTypeRepository } from "../repos/nodeTypeRepository";
import type { Node } from "../models/node/node";

export interface CreateNodeRequest {
    structureId: number;
    parentId?: number | null;
    nodeTypeCode: string;
    referenceCode?: string | null;
    title: string;
    sortOrder?: number;
    description?: string | null;
    createdBy?: number | null;
}

export class NodeServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NodeServiceError";
    }
}

export class NodeService {
    constructor(private readonly knex: Knex) {}

    async createNode(data: CreateNodeRequest): Promise<Node> {
        if (!data.title || !data.title.trim()) {
            throw new Error("Node title is required");
        }

        if (!data.structureId || data.structureId <= 0) {
            throw new Error("Valid structureId is required");
        }

        if (!data.nodeTypeCode) {
            throw new Error("Node type code is required");
        }

        return this.knex.transaction(async (trx) => {
            const nodeRepository = new NodeRepository(this.knex, trx);
            const nodeTypeRepository = new NodeTypeRepository(this.knex, trx);

            // Find the requested node type using nodeTypeCode
            const childType = await nodeTypeRepository.findByCode(
                data.nodeTypeCode
            );

            if (!childType) {
                throw new Error(
                    `Node type '${data.nodeTypeCode}' does not exist or is inactive`
                );
            }

            const parentId = data.parentId ?? null;

            // Validate root nodes.
            if (parentId === null) {
                const allowedRootTypes = [
                        "verksamhetsomrade",
                        "strukturenhet"
                 ];

                if (!allowedRootTypes.includes(childType.code.toLowerCase())) {
                    throw new NodeServiceError(
                        "This node type is not allowed as a root node"
                    );
                }
            } else {
                // Find the parent node.
                const parent = await nodeRepository.findById(parentId);
                console.log("DEBUG parent:", parent);
                console.log("DEBUG requested structureId:", data.structureId);
                console.log("DEBUG parent structureId:", parent?.structureId);
                console.log(
                        "DEBUG comparison:",
                          parent?.structureId !== data.structureId
                );
                if (!parent) {
                    throw new Error("Parent node was not found");
                }

                // Ensure parent and child belong to the same structure.
                if (parent.structureId !== data.structureId) {
                    throw new Error(
                        "Parent node must belong to the same structure"
                    );
                }

                // Check whether this parent-child relationship is allowed.
                const isAllowed = await nodeTypeRepository.isAllowedChild(
                    parent.nodeTypeId,
                    childType.id
                );

                if (!isAllowed) {
                    throw new Error(
                        `Node type '${data.nodeTypeCode}' is not allowed under this parent`
                    );
                }
            }

            // Check whether a node with the same reference code already exists.
            if (data.referenceCode !== undefined && data.referenceCode !== null) {
                const alreadyExists =
                    await nodeRepository.existsByStructureParentAndReferenceCode(
                        data.structureId,
                        parentId,
                        data.referenceCode
                    );

                if (alreadyExists) {
                    throw new NodeServiceError(
                        `A node with reference code '${data.referenceCode}' already exists under this parent`
                    );
                }
            }
            // Create the node using CreateNodeData structure (nodeTypeId)
            return nodeRepository.createNode({
                structureId: data.structureId,
                parentId,
                nodeTypeId: childType.id,
                referenceCode: data.referenceCode ?? null,
                title: data.title.trim(),
                sortOrder: data.sortOrder ?? 0,
                description: data.description ?? null,
                createdBy: data.createdBy ?? null
            });
        });
    }
}