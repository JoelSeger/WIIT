import { Router } from "express";
import type { Knex } from "knex";
import { AuthController } from "../controllers/authController";
import { AuthService } from "../services/authService";
import { UserRepository } from "../repos/userRepository";
import { AdGroupRoleRepository } from "../repos/adGroupRoleRepository";

/**
 * Two switches on purpose: a dev login left on in production would let anyone
 * make themselves admin. When it is off, the route does not exist at all (404),
 * which is safer than a route that checks and answers 403.
 */
export function devLoginAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN === "true";
}

/** Mounted at /api/auth in server.ts. Needs the camelCase `db` (users rows become User objects). */
export function createAuthRouter(db: Knex): Router {
  const router = Router();
  const controller = new AuthController(
    new AuthService(new UserRepository(db, "users"), new AdGroupRoleRepository(db)),
  );

  if (devLoginAllowed()) {
    router.post("/dev-login", controller.devLogin);
  }

  router.get("/me", controller.me);
  router.post("/logout", controller.logout);

  // Later, real SSO (OIDC): GET /login and GET /callback go here and call the same AuthService.login

  return router;
}
