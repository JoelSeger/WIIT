import type { Knex } from "knex";

/**
 * SQL for ad_group_roles: which WIIT role an MAU AD group gives.
 * Only queries here, the login logic is in AuthService.
 */
export class AdGroupRoleRepository {
  constructor(private readonly knex: Knex) {}

  /**
   * The distinct roles that any of the groups gives.
   * structure_id is ignored for now: a role applies to every structure.
   */
  async rolesForGroups(groups: string[]): Promise<string[]> {
    if (groups.length === 0) return [];
    const rows: { role: string }[] = await this.knex("ad_group_roles")
      .whereIn("ad_group", groups)
      .distinct("role");
    return rows.map((r) => r.role);
  }
}
