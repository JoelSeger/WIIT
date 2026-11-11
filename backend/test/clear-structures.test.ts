/**
 * scripts/clear-structures.ts: removes structures but keeps arkivbildare, so an import can be
 * shown again. Same SQLite setup as the other tests.
 *
 *   npx tsx test/clear-structures.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import knexLib, { type Knex } from 'knex';
import { createTables } from './sqliteSchema';
import { EadImportService } from '../src/services/EADImportService';
import { clearStructures, countStructureData } from '../scripts/clear-structures';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed } = require('../seeds/01_demo') as { seed: (knex: Knex) => Promise<void> };

(async () => {
  const knex = knexLib({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  await createTables(knex);
  await seed(knex);
  const admin = (await knex('users').first('id')).id as number;
  const xml = fs.readFileSync(path.join(__dirname, 'fixtures/klara-sample.ead3.xml'), 'utf8');
  const service = new EadImportService(knex);
  const options = { sourceFileName: 'klara-sample.ead3', userId: admin };
  await service.import(xml, options);

  // Seed and import together: what the user had
  const before = await countStructureData(knex);
  assert.ok(before.structures >= 4, 'seed + import gives at least four structures');
  assert.ok(before.nodes > 0 && before.node_relations > 0);
  console.log('ok  count: nothing removed without --ja', before.structures, 'structures');
  assert.equal((await countStructureData(knex)).structures, before.structures);

  const removed = await clearStructures(knex);
  assert.equal(removed.structures, before.structures);
  const after = await countStructureData(knex);
  assert.ok(Object.values(after).every((rows) => rows === 0), 'everything structure-related is gone');
  console.log('ok  clear: structures, nodes, values, relations and links removed');

  // Arkivbildare and archive stay, so the import can be linked to Malmö universitet again
  assert.equal((await knex('archive_creators').count({ n: '*' }).first())?.n, 2);
  assert.ok(await knex('archives').where({ reference_code: 'MAU-001' }).first('id'));
  console.log('ok  keeps: arkivbildare and MAU-001');

  // The same file can be imported again (no 409)
  const archive = await knex('archives').where({ reference_code: 'MAU-001' }).first('id');
  const again = await service.import(xml, { ...options, archiveId: archive.id });
  assert.equal(again.structures.length, 2);
  console.log('ok  the same file can be imported again');

  await knex.destroy();
  console.log('\nAll clear-structures tests passed');
})().catch((err) => { console.error(err); process.exit(1); });
