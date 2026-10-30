import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { NodeType } from "../models/node/nodeType";

export class NodeTypeRepository extends CrudRepository<NodeType> {
    constructor(knex: Knex, trx?: Knex.Transaction) {
        super(knex, "node_types", trx);
    }

    async findByCode(code: string): Promise<NodeType | undefined> {
        const row = await this.qb
            .where({
                code,
                is_active: true
            })
            .first();

        if (!row) {
            return undefined;
        }

        return {
            id: row.id,
            code: row.code,
            name: row.name,
            structureType: row.structure_type,
            eadLevel: row.ead_level,
            eadOtherlevel: row.ead_otherlevel,
            eadUnitDescription: row.ead_unit_description,
            description: row.description,
            isActive: row.is_active
        };
    }

    async isAllowedChild(
        parentTypeId: number,
        childTypeId: number
        ): Promise<boolean> {
        const db = this.trx ?? this.knex;

        const rule = await db("node_type_rules")
            .where({
            parent_type_id: parentTypeId,
            child_type_id: childTypeId
            })
            .first();

        return rule !== undefined;
}
}