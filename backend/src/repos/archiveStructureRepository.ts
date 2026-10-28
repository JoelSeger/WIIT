
import type { Knex } from "knex";

export interface ArchiveStructure {
  id: number;
  archive_id: number;
  structure_id: number;
  valid_from: Date | null;
  valid_to: Date | null;
  created_at: Date;
  created_by: number | null;
}

export class ArchiveStructureRepository {
  constructor(
    private readonly knex: Knex,
    private readonly trx?: Knex.Transaction,
  ) {}

  private get qb(): Knex.QueryBuilder {
    return (this.trx ?? this.knex)("archive_structures");
  }

  async create(
    item: Omit<ArchiveStructure, "id" | "created_at">,
  ): Promise<ArchiveStructure> {
    const [created] = await this.qb
      .insert(item)
      .returning("*");

    return created as ArchiveStructure;
  }
}
