/**
 * Auth test runs without SQL Server, same SQLite setup as the search test.
 *
 *   npx tsx test/auth.test.ts
 *
 * Uses the demo seed: MAU-Arkivfunktionen = admin, MAU-Registratorer = editor.
 */

import assert from 'node:assert/strict';
import knexLib, { type Knex } from 'knex';
import knexStringcase from 'knex-stringcase';
import type { Request, Response } from 'express';
import { createTables } from './sqliteSchema';
import { UserRepository } from '../src/repos/userRepository';
import { AdGroupRoleRepository } from '../src/repos/adGroupRoleRepository';
import { AuthService, InactiveUserError } from '../src/services/authService';
import { AuthController } from '../src/controllers/authController';
import { hasRole, requireRole } from '../src/middleware/auth';
import { devLoginAllowed } from '../src/routers/authRoutes';
import type { SessionUser } from '../src/types/session';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed } = require('../seeds/01_demo') as { seed: (knex: Knex) => Promise<void> };

interface FakeResult { status: number; body: { success: boolean; data?: unknown; error?: string } }

/** Fake req with a session that remembers what the controller stores in it. */
function fakeReq(body: unknown, user?: SessionUser): Request {
  const session: Record<string, unknown> = { user };
  Object.assign(session, {
    regenerate(cb: (err?: Error) => void) { delete session.user; cb(); },
    destroy(cb: (err?: Error) => void) { delete session.user; cb(); },
  });
  return { body, session, user } as unknown as Request;
}

function fakeRes(resolve: (r: FakeResult) => void): Response {
  let status = 200;
  return {
    status(code: number) { status = code; return this; },
    json(body: FakeResult['body']) { resolve({ status, body }); return this; },
    clearCookie() { return this; },
  } as unknown as Response;
}

function callDevLogin(c: AuthController, req: Request): Promise<FakeResult> {
  return new Promise((resolve, reject) => {
    c.devLogin(req, fakeRes(resolve), reject).catch(reject);
  });
}

/** Runs requireRole and reports whether it let the request through, or which status it sent. */
function runRequireRole(req: Request, ...roles: string[]): Promise<number | 'next'> {
  return new Promise((resolve) => {
    requireRole(...roles)(req, fakeRes((r) => resolve(r.status)), () => resolve('next'));
  });
}

(async () => {
  delete process.env.AUTH_DISABLED;

  const db = knexLib({
    client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    ...knexStringcase(),
  });
  await createTables(db);
  await seed(db);

  const users = new UserRepository(db, 'users');
  const service = new AuthService(users, new AdGroupRoleRepository(db));
  const controller = new AuthController(service);

  // roles from AD groups
  {
    const admin = await service.login({ adObjectId: 'dev-a', username: 'a', groups: ['MAU-Arkivfunktionen'] });
    assert.deepEqual(admin.roles, ['admin']);
    const none = await service.login({ adObjectId: 'dev-b', username: 'b', groups: ['Some-Other-Group'] });
    assert.deepEqual(none.roles, []);
    const both = await service.login({ adObjectId: 'dev-c', username: 'c', groups: ['MAU-Arkivfunktionen', 'MAU-Registratorer'] });
    assert.deepEqual([...both.roles].sort(), ['admin', 'editor']);
    console.log('✓ roles come from ad_group_roles; unknown groups give no role');
  }

  // upsert: second login updates, does not create a duplicate
  {
    const first = await service.login({ adObjectId: 'dev-d', username: 'd', groups: [] });
    const second = await service.login({ adObjectId: 'dev-d', username: 'd', email: 'd@mau.se', groups: [] });
    assert.equal(first.id, second.id);
    const rows = await db('users').where({ ad_object_id: 'dev-d' });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, 'd@mau.se');
    assert.ok(rows[0].lastLoginAt);
    console.log('✓ second login updates the same user (no duplicate), sets last_login_at');
  }

  // inactive users may not log in
  {
    await db('users').where({ ad_object_id: 'dev-d' }).update({ is_active: false });
    await assert.rejects(service.login({ adObjectId: 'dev-d', username: 'd', groups: [] }), InactiveUserError);
    console.log('✓ is_active = false blocks login');
  }

  // hasRole
  {
    const as = (roles: string[]) => fakeReq(undefined, { roles } as SessionUser);
    assert.equal(hasRole(as(['editor']), 'editor'), true);
    assert.equal(hasRole(as(['admin']), 'editor'), true, 'admin includes editor');
    assert.equal(hasRole(as(['viewer']), 'editor'), false);
    assert.equal(hasRole(fakeReq(undefined), 'editor'), false, 'visitor');
    console.log('✓ hasRole: editor yes, admin includes editor, viewer and visitor no');
  }

  // requireRole: 401 vs 403
  {
    assert.equal(await runRequireRole(fakeReq(undefined), 'editor'), 401);
    assert.equal(await runRequireRole(fakeReq(undefined, { roles: ['viewer'] } as SessionUser), 'editor'), 403);
    assert.equal(await runRequireRole(fakeReq(undefined, { roles: ['editor'] } as SessionUser), 'editor'), 'next');
    console.log('✓ requireRole: 401 not logged in, 403 wrong role, passes with role');
  }

  // dev-login through the controller
  {
    const req = fakeReq({ username: 'ai6999', groups: ['MAU-Registratorer'] });
    const r = await callDevLogin(controller, req);
    assert.equal(r.status, 200);
    assert.deepEqual((r.body.data as { roles: string[] }).roles, ['editor']);
    const stored = (req.session as unknown as { user: SessionUser }).user;
    assert.equal(stored.adObjectId, 'dev-ai6999');
    assert.ok(!('rowVersion' in (r.body.data as object)), 'only public fields are sent');
    console.log('✓ dev-login stores the user + roles in the session, prefix dev-');

    assert.equal((await callDevLogin(controller, fakeReq({ username: '' }))).status, 400);
    assert.equal((await callDevLogin(controller, fakeReq({ username: 'x', groups: 'MAU' }))).status, 400);
    assert.equal((await callDevLogin(controller, fakeReq({ username: 'x y' }))).status, 400);
    console.log('✓ dev-login rejects missing username, bad characters, groups that are not a list');
  }

  // the switch
  {
    const saved = { env: process.env.NODE_ENV, dev: process.env.DEV_LOGIN };
    process.env.NODE_ENV = 'development'; process.env.DEV_LOGIN = 'true';
    assert.equal(devLoginAllowed(), true);
    process.env.NODE_ENV = 'production';
    assert.equal(devLoginAllowed(), false, 'never in production');
    process.env.NODE_ENV = 'development'; delete process.env.DEV_LOGIN;
    assert.equal(devLoginAllowed(), false, 'off unless DEV_LOGIN=true');
    process.env.NODE_ENV = saved.env; if (saved.dev !== undefined) process.env.DEV_LOGIN = saved.dev;
    console.log('✓ dev login only when NODE_ENV != production AND DEV_LOGIN=true');
  }

  await db.destroy();
  console.log('\nAll auth tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
