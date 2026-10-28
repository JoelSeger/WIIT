import type { Knex } from "knex";
import { CrudRepository } from "./crudRepository";
import type { Structure } from "../models/structure/structure";

export class StructureRepository extends CrudRepository<Structure> {
  constructor(knex: Knex) {
    super(knex, "structures");
  }

  async findById(id: number): Promise<Structure | undefined> {
    return this.qb.where({ id }).first();
  }
}
