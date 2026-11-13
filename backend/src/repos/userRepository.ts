import { Knex } from "knex";
import { User } from "../models/user";
import { CrudRepository } from "./crudRepository";

export class UserRepository extends CrudRepository<User> {
  constructor(knex: Knex, tableName: string) {
    super(knex, tableName);
  }

  async getAll(limit: number, offset: number): Promise<User[]> {
    const users = await super.findAll(limit, offset);
    if (!users) {
      throw new Error("No Users found!")
    }
    console.log("DB RESULT:", users);
    return users;
  }

  /** The user with this AD/Entra objectId, or undefined. */
  async findByAdObjectId(adObjectId: string): Promise<User | undefined> {
    return this.qb.where({ adObjectId }).first();
  }

  /**
   * Login: updates last_login_at for an existing user, or creates the user.
   * Name and e-mail are refreshed too, since they can change in AD.
   */
  async upsertOnLogin(login: {
    adObjectId: string;
    username: string;
    displayName?: string | null;
    email?: string | null;
  }): Promise<User> {
    const fields = {
      username: login.username,
      displayName: login.displayName ?? null,
      email: login.email ?? null,
      lastLoginAt: new Date(),
    };

    const existing = await this.findByAdObjectId(login.adObjectId);
    if (existing) {
      await this.qb.where({ id: existing.id }).update(fields);
      return { ...existing, ...fields };
    }

    const [created] = await this.qb
      .insert({ adObjectId: login.adObjectId, ...fields })
      .returning("*");
    return created;
  }

}
