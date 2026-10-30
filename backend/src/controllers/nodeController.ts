
import type { Request, Response } from "express";
import { NodeService } from "../services/nodeService";

export class NodeController {
    constructor(private readonly nodeService: NodeService) {}

    createNode = async (req: Request, res: Response): Promise<void> => {
        try {
            const node = await this.nodeService.createNode(req.body);

            res.status(201).json({
                success: true,
                message: "Node created successfully",
                data: node
            });
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "An unexpected error occurred";

            // Handle expected validation errors.
            const validationMessages = [
                "Node title is required",
                "Valid structureId is required",
                "Node type code is required",
                "Parent node was not found",
                "Parent node must belong to the same structure"
            ];

            const isValidationError =
                validationMessages.includes(message) ||
                message.includes("is not allowed under this parent") ||
                message.includes("already exists");

            if (isValidationError) {
                res.status(400).json({
                    success: false,
                    message
                });
                return;
            }

            // Handle SQL Server duplicate key errors.
            const dbError = error as {
                number?: number;
                originalError?: {
                    number?: number;
                };
            };

            const errorNumber =
                dbError?.number ?? dbError?.originalError?.number;

            if (errorNumber === 2601 || errorNumber === 2627) {
                res.status(409).json({
                    success: false,
                    message: "A node with the same unique key already exists"
                });
                return;
            }

            console.error("Error creating node:", error);

            res.status(500).json({
                success: false,
                message: "An unexpected error occurred while creating the node"
            });
        }
    };
}
