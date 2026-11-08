/**
 * Search test runs without SQL Server, same SQLite setup as the EAD tests.
 *
 *   npx tsx test/search.test.ts
 *
 * Uses the demo seed: Informationshanteringsplan (klassificering) and Förvaringsenheter (forvaring).
 * "Förbereda forskning och söka extern finansiering" exists in both trees, which makes it a
 * good cross-tree case. Sekretess and Placering are non-public fields in the seed.
 */

import assert from 'node:assert/strict';
import knexLib, { type Knex } from 'knex';
import knexStringcase from 'knex-stringcase';
import type { Request, Response } from 'express';
import { createTables } from './sqliteSchema';
import { SearchRepository } from '../src/repos/searchRepository';
import { SearchService, escapeLike } from '../src/services/searchService';
import { SearchController } from '../src/controllers/searchController';
import type { SearchInput } from '../src/models/search/search';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed } = require('../seeds/01_demo') as { seed: (knex: Knex) => Promise<void> };

const input = (q: string, extra: Partial<SearchInput> = {}): SearchInput => ({ q, limit: 20, offset: 0, ...extra });

/** Minimal fake of Express req/res for the controller. */
interface FakeResponse { status: number; body: { success: boolean; data: { total: number; limit: number } } }

function call(controller: SearchController, query: Record<string, string>): Promise<FakeResponse> {
  return new Promise((resolve) => {
    let status = 200;
    const res = {
      status(code: number) { status = code; return this; },
      json(body: FakeResponse['body']) { resolve({ status, body }); return this; },
    } as unknown as Response;
    void controller.search({ query } as unknown as Request, res);
  });
}

(async () => {
  // camelCase results like `db` in config/db.ts. snake_case names in the seed and below stay snake_case.
  const raw = knexLib({
    client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    ...knexStringcase(),
  });
  await createTables(raw);
  await seed(raw);
  const db = raw;

  const service = new SearchService(new SearchRepository(db));
  const ihp = (await raw('structures').where({ code: 'ihp' }).first()).id as number;
  const forv = (await raw('structures').where({ code: 'forvaring' }).first()).id as number;

  // escapeLike
  assert.equal(escapeLike('100%_[x]\\'), '100\\%\\_\\[x]\\\\');
  console.log('✓ escapeLike: % _ [ \\ escaped');

  // title hit, in the Förvaring tree
  {
    const r = await service.search(input('ladok'), false);
    assert.equal(r.total, 1);
    const [hit] = r.results;
    assert.ok(hit);
    assert.equal(hit.title, 'Ladok');
    assert.equal(hit.structureId, forv);
    assert.equal(hit.structureType, 'forvaring');
    assert.equal(hit.structureName, 'Förvaringsenheter');
    assert.deepEqual(hit.nodeType, { code: 'verksamhetssystem', name: 'Verksamhetssystem' });
    assert.deepEqual(hit.path.map((p) => p.title), ['Verksamhetssystem']);
    assert.equal(hit.matches[0]?.field, 'title');
    console.log('✓ F4.1 title hit (case-insensitive), structure and node type returned');
  }

  // one search, hits in both trees
  {
    const r = await service.search(input('extern finansiering'), false);
    assert.deepEqual(new Set(r.results.map((h) => h.structureId)), new Set([ihp, forv]));
    console.log(`✓ F4.1 cross-tree search: ${r.total} hits in both Informationshanteringsplan and Förvaringsenheter`);

    const only = await service.search(input('extern finansiering', { structureType: 'forvaring' }), false);
    assert.ok(only.total > 0);
    assert.ok(only.results.every((h) => h.structureType === 'forvaring'));
    const byId = await service.search(input('extern finansiering', { structureId: ihp }), false);
    assert.ok(byId.results.every((h) => h.structureId === ihp));
    console.log('✓ F4.1 structureType / structureId filters');
  }

  // path from the root, in order
  {
    const r = await service.search(input('Ansökan om extern finansiering'), false);
    const hit = r.results.find((h) => h.structureId === ihp);
    assert.ok(hit);
    assert.deepEqual(hit.path.map((p) => p.referenceCode), ['4', '4.2', '4.2.1', 'HS']);
    assert.equal(hit.path[0]?.title, 'Bedriva forskning');
    assert.equal(r.results[0]?.nodeId, hit.nodeId, 'exact title ranks first');
    console.log('✓ F4.2 search result navigation: path from the root down to the parent (4 / 4.2 / 4.2.1 / HS)');
  }

  //Ranking: exact reference code first
  {
    const r = await service.search(input('HT1'), false);
    assert.ok(r.total >= 2);
    assert.equal(r.results[0]?.referenceCode, 'HT1');
    assert.equal(r.results[1]?.referenceCode, 'HT1');
    console.log('✓ F4.1 ranking: exact reference code first');
  }

  //Property values
  {
    const r = await service.search(input('RA-FS 2021'), false);
    assert.equal(r.total, 1);
    const m = r.results[0]?.matches.find((x) => x.field === 'property');
    assert.equal(m?.label, 'Gallringsföreskrifter');
    assert.equal(m?.snippet, 'RA-FS 2021:6');
    console.log('✓ F4.1 property hit with label and snippet');

    const pub = await service.search(input('RA-FS 2021'), true);
    assert.equal(pub.total, 1, 'public field is searchable in public mode');
    console.log('✓ F5.4 public field found in public mode');
  }

  //OSL: non-public fields are never searched in public mode
  {
    assert.equal((await service.search(input('OSL 24'), false)).total, 1, 'editor finds sekretess');
    assert.equal((await service.search(input('OSL 24'), true)).total, 0, 'public must not');
    assert.equal((await service.search(input('hylla 3'), false)).total, 1, 'editor finds placering');
    assert.equal((await service.search(input('hylla 3'), true)).total, 0, 'public must not');
    console.log('✓ F5.4 / OSL: Sekretess and Placering not searchable in public mode');
  }

  // Public mode: unpublished node, parent and structure
  {
    const ansokan = await raw('nodes').where({ title: 'Ansökan om extern finansiering' }).first();
    const parentGroup = await raw('nodes').where({ structure_id: ihp, reference_code: '4.2' }).first();

    await raw('nodes').where({ id: ansokan.id }).update({ is_published: false });
    assert.equal((await service.search(input('Ansökan om'), true)).total, 0, 'unpublished node');
    assert.equal((await service.search(input('Ansökan om'), false)).total, 1, 'editor still sees it');
    await raw('nodes').where({ id: ansokan.id }).update({ is_published: true });

    await raw('nodes').where({ id: parentGroup.id }).update({ is_published: false });
    const underHidden = await service.search(input('Ansökan om'), true);
    assert.equal(underHidden.total, 0, 'node under an unpublished parent');
    await raw('nodes').where({ id: parentGroup.id }).update({ is_published: true });
    assert.equal((await service.search(input('Ansökan om'), true)).total, 1, 'visible again');

    await raw('structures').where({ id: forv }).update({ is_published: false });
    assert.equal((await service.search(input('ladok'), true)).total, 0, 'unpublished structure');
    await raw('structures').where({ id: forv }).update({ is_published: true });
    console.log('✓ F5.4 / F5.3.5 public mode: unpublished node, parent and structure hidden, same as getTree');
  }

  //Wildcards are literal
  {
    assert.equal((await service.search(input('HT_'), false)).total, 0, '_ is not a wildcard');
    assert.equal((await service.search(input('100%'), false)).total, 0, '% is not a wildcard');
    assert.equal((await service.search(input('[HT]'), false)).total, 0, '[ is not a character class');
    console.log('✓ D1 % _ [ in the query are literal');
  }

  // Paging
  {
    const all = await service.search(input('HT'), false);
    assert.ok(all.total >= 5);
    const page1 = await service.search(input('HT', { limit: 2 }), false);
    assert.equal(page1.results.length, 2);
    assert.equal(page1.total, all.total);
    const last = await service.search(input('HT', { limit: 2, offset: all.total - 1 }), false);
    assert.equal(last.results.length, 1);
    assert.equal(last.results[0]?.nodeId, all.results[all.total - 1]?.nodeId);
    console.log('✓ F4.1 limit / offset, total is independent of the page');
  }

  //Controller: validation and mode
  {
    const controller = new SearchController(service);
    delete process.env.AUTH_DISABLED;

    assert.equal((await call(controller, { q: 'a' })).status, 400, 'q too short');
    assert.equal((await call(controller, {})).status, 400, 'q missing');
    assert.equal((await call(controller, { q: 'ladok', structureId: 'x' })).status, 400);
    assert.equal((await call(controller, { q: 'ladok', structureType: "x'; drop" })).status, 400);

    const ok = await call(controller, { q: 'ladok', limit: '9999' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.success, true);
    assert.equal(ok.body.data.limit, 100, 'limit capped');
    assert.equal(ok.body.data.total, 1);

    // Not logged in = public mode
    assert.equal((await call(controller, { q: 'OSL 24' })).body.data.total, 0, 'anonymous = public');
    process.env.AUTH_DISABLED = 'true';
    assert.equal((await call(controller, { q: 'OSL 24' })).body.data.total, 1, 'AUTH_DISABLED = editor (dev only)');
    delete process.env.AUTH_DISABLED;
    console.log('✓ D1 / F5.4 controller: 400 on bad input, limit capped, anonymous gets public mode');
  }

  await raw.destroy();
  console.log('All search tests passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
