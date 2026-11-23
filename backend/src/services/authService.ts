import type { SessionUser } from "../types/session";
import type { UserRepository } from "../repos/userRepository";
import type { AdGroupRoleRepository } from "../repos/adGroupRoleRepository";

/**
 * Who someone is, as told by the login method.
 * Dev login: from the request body. Real SSO (OIDC): from Microsoft's ID token
 * (adObjectId = the "oid" claim, groups = the "groups" claim).
 */
export interface LoginIdentity {
  adObjectId: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  groups: string[];
}

/**
 * The part of the login that is the same for dev login and real SSO:
 * find or create the user, then look up the roles their AD groups give.
 */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly groupRoles: AdGroupRoleRepository,
  ) {}

  async login(identity: LoginIdentity): Promise<SessionUser> {
    const user = await this.users.upsertOnLogin(identity);
    // MSSQL returns false, SQLite (tests) returns 0; null/undefined = not set, counts as active
    if (user.isActive != null && !user.isActive) throw new InactiveUserError();

    const roles = await this.groupRoles.rolesForGroups(identity.groups);
    return { ...user, roles };
  }
}

/** users.is_active = false: the account exists but may not log in. */
export class InactiveUserError extends Error {
  constructor() {
    super("User is inactive");
  }
}
