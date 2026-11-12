/**
 * GET /api/archive-creators: runs without SQL Server, same SQLite setup as the other tests.
 *
 *   npx tsx test/archive-creators.test.ts
 *
 * Uses the demo seed: Malmö universitet owns Informationshanteringsplan and Förvaringsenheter
 * through the archive MAU-001; Malmö högskola 1998–2015 has no structures yet.
 */

import assert from 'node:assert/strict';
import knexLib, { type Knex } from 'knex';
import knexStringcase from 'knex-stringcase';
import { createTables } from './sqliteSchema';
import { ArchiveCreatorSummaryRepository } from '../src/repos/archiveCreatorSummaryRepository';
import { findUnlinkedStructures, setupArchiveCreators } from '../scripts/setup-arkivbildare';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed } = require('../seeds/01_demo') as { seed: (knex: Knex) => Promise<void> };

(async () => {
  // camelCase results like `db` in config/db.ts. snake_case names in the seed and below stay snake_case.
  const raw = knexLib({
    client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true,
    ...knexStringcase(),
  });
  await createTables(raw);
  await seed(raw);
  const db = raw;
  const repo = new ArchiveCreatorSummaryRepository(db);

  const ihp = await raw('structures').where({ code: 'ihp' }).first('id');
  const forv = await raw('structures').where({ code: 'forvaring' }).first('id');

  // Editor: both creators, sorted by name, with their structures
  const all = await repo.findSummaries(false);
  assert.deepEqual(all.map((c) => c.name), ['Malmö högskola 1998–2015', 'Malmö universitet']);
  const mau = all.find((c) => c.name === 'Malmö universitet');
  assert.deepEqual(mau?.structureIds, [ihp.id, forv.id].sort((a, b) => a - b));
  const mah = all.find((c) => c.name.startsWith('Malmö högskola'));
  assert.deepEqual(mah?.structureIds, []);
  assert.equal(mah?.startYear, 1998);
  assert.deepEqual(mau?.archives.map((a) => [a.referenceCode, a.name]), [['MAU-001', 'Malmö universitets arkiv']]);
  assert.deepEqual(mah?.archives, []);
  console.log('ok  editor: creators with structure ids and archives');

  // Public: an unpublished structure is left out of structureIds
  await raw('structures').where({ id: forv.id }).update({ is_published: false });
  const pub = await repo.findSummaries(true);
  assert.deepEqual(pub.find((c) => c.name === 'Malmö universitet')?.structureIds, [ihp.id]);
  console.log('ok  public: unpublished structure is hidden');

  // Public: an unpublished creator is left out
  await raw('archive_creators').where({ name: 'Malmö universitet' }).update({ is_published: false });
  const pub2 = await repo.findSummaries(true);
  assert.deepEqual(pub2.map((c) => c.name), ['Malmö högskola 1998–2015']);
  console.log('ok  public: unpublished creator is hidden');

  await raw.destroy();

  // scripts/setup-arkivbildare.ts on a database filled by an import only (no seed, no creators)
  {
    const fresh = knexLib({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
    await createTables(fresh);
    const [row] = await fresh('structures').insert(
      { code: 'ks-ihp', name: 'Informationshanteringsplan', structure_type: 'klassificering', is_published: true },
      ['id'],
    );
    const structureId = row.id as number;
    assert.deepEqual((await findUnlinkedStructures(fresh)).map((s) => s.id), [structureId]);

    const first = await setupArchiveCreators(fresh, [structureId]);
    assert.equal(first.created.length, 3);
    assert.deepEqual(first.linked, [structureId]);
    const second = await setupArchiveCreators(fresh, [structureId]);
    assert.deepEqual(second.created, []);
    assert.deepEqual(second.alreadyLinked, [structureId]);
    assert.equal((await fresh('archive_creators').count({ n: '*' }))[0].n, 2);
    assert.deepEqual(await findUnlinkedStructures(fresh), []);
    await assert.rejects(setupArchiveCreators(fresh, [999]), /finns inte: 999/);
    await fresh.destroy();
    console.log('ok  setup-arkivbildare: creates once, links, can run again');
  }

  console.log('\nAll archive-creator tests passed');
})().catch((err) => { console.error(err); process.exit(1); });
