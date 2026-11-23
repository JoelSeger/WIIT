/**
 * RA-EAD test (Riksarkivet's EAD 2002 variant, the format of GV.ead / LS.ead) – runs without
 * SQL Server, same SQLite setup as ead-import.test.ts.
 *
 *   npx tsx test/ra-ead.test.ts
 *   EAD3_XSD=schema/ead3/ead3.xsd npx tsx test/ra-ead.test.ts                (also validate the EAD3 export)
 *   RA_EAD_FILES=path/to/GV.ead,path/to/LS.ead npx tsx test/ra-ead.test.ts   (also import the real files)
 *
 * 1. Import of test/fixtures/ra-ead-sample.ead (hand-written): one arkivförteckning with the tree
 *    Arkiv / Serie / Volym, linked to an arkiv and arkivbildare that the import creates, fields, log.
 * 2. A second file with the same <eadid> and arkivbildare is not mistaken for the first.
 * 3. Export: valid EAD3, and RA-EAD that gives the same tree when it is imported again.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import knexLib, { type Knex } from 'knex';
import { createTables } from './sqliteSchema';
import { EadImportService } from '../src/services/EADImportService';
import { EadImportConflictError } from '../src/ead/eadImport';
import { loadStructure, type TreeNode } from '../src/ead/loadStructure';
import { buildEad3 } from '../src/ead/buildEad3';
import { buildRaEad } from '../src/ead/buildRaEad';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { seed } = require('../seeds/01_demo') as { seed: (knex: Knex) => Promise<void> };

async function freshDb(): Promise<Knex> {
  const knex = knexLib({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
  await createTables(knex);
  await seed(knex);
  return knex;
}

const count = async (knex: Knex, table: string, where: object = {}): Promise<number> =>
  Number((await knex(table).where(where).count({ n: '*' }).first())?.n);

function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

/** What must survive a round trip: position, type, code, title and every field value. */
function summary(roots: TreeNode[]): unknown[] {
  return flatten(roots).map((n) => [
    n.type.code, n.reference_code, n.title,
    n.properties.map((p) => `${p.key}=${p.value}`).sort(),
    n.children.length,
  ]);
}

(async () => {
  const knex = await freshDb();
  const service = new EadImportService(knex);
  const admin = (await knex('users').first('id')).id as number;
  const sample = fs.readFileSync(path.join(__dirname, 'fixtures/ra-ead-sample.ead'), 'utf8');

  // 1. Import
  const structuresBefore = await count(knex, 'structures');
  const preview = service.preview(sample);
  assert.equal(preview.valid, true);
  assert.equal(preview.metadata.format, 'ra-ead');
  assert.equal(preview.metadata.recordId, '77');
  assert.deepEqual(preview.trees, [{ name: 'Testförvaltningen 2001 - 2010', structureType: 'arkivforteckning', nodeCount: 7 }]);
  assert.equal(preview.archive?.creatorName, 'Testhögskolan 2001-2010');
  assert.deepEqual(preview.warnings, [], 'a volume without a title is normal in RA-EAD, not a warning');
  assert.equal(await count(knex, 'structures'), structuresBefore, 'preview writes nothing');
  console.log('✓ preview: RA-EAD detected, one arkivförteckning, nothing written');

  const result = await service.import(sample, { sourceFileName: 'ra-ead-sample.ead', userId: admin });
  const [imported] = result.structures;
  assert.ok(imported);
  assert.equal(result.structures.length, 1);
  assert.equal(imported.structureType, 'arkivforteckning');
  assert.equal(imported.nodeCount, 7, '1 arkiv + 2 serier + 4 volymer');

  const structure = await knex('structures').where({ id: imported.id }).first();
  assert.equal(structure.name, 'Testförvaltningen 2001 - 2010');
  assert.equal(Boolean(structure.is_published), false, 'an imported arkivförteckning starts unpublished');
  console.log('✓ structure: arkivförteckning, named after the file, unpublished');

  // Arkiv and arkivbildare from <archdesc> / <origination>
  assert.ok(result.archive);
  assert.equal(result.archive.created, true);
  assert.equal(result.archive.creatorCreated, true);
  const archive = await knex('archives').where({ id: result.archive.id }).first();
  assert.equal(archive.name, 'Testförvaltningen 2001 - 2010');
  assert.equal(archive.description,
    'Historik för\nTestförvaltningen.\n\nFörteckning upprättad som testdata.\n\nArkivbildaren bytte namn 2005.');
  const creator = await knex('archive_creators').where({ id: archive.archive_creator_id }).first();
  assert.equal(creator.name, 'Testhögskolan 2001-2010');
  assert.equal(creator.external_id, '/77');
  assert.equal(await count(knex, 'archive_structures', { archive_id: archive.id, structure_id: imported.id }), 1);
  console.log('✓ arkiv and arkivbildare created and linked; custodhist + odd as description');

  // Node types: created once, with the rules Arkiv - Serie - Volym so nodes can be added afterwards
  assert.deepEqual(result.createdNodeTypes,
    ['Arkiv (arkivforteckning)', 'Serie (arkivforteckning)', 'Volym (arkivforteckning)']);
  const arkiv = await knex('node_types').where({ structure_type: 'arkivforteckning', ead_level: 'fonds' }).first();
  assert.equal(arkiv.name, 'Arkiv');
  assert.equal(await count(knex, 'node_type_rules', { parent_type_id: arkiv.id, child_type_id: (await knex('node_types').where({ structure_type: 'arkivforteckning', ead_level: 'series' }).first()).id }), 1);
  const serie = await knex('node_types').where({ structure_type: 'arkivforteckning', ead_level: 'series' }).first();
  const volym = await knex('node_types').where({ structure_type: 'arkivforteckning', ead_otherlevel: 'volym' }).first();
  assert.equal(serie.name, 'Serie');
  assert.equal(volym.name, 'Volym');
  assert.equal(await count(knex, 'node_type_rules', { parent_type_id: serie.id, child_type_id: volym.id }), 1);
  console.log('✓ node types Arkiv, Serie and Volym created, with the rules Arkiv - Serie - Volym');

  const loaded = await loadStructure(knex, imported.id);
  assert.ok(loaded);
  const values = (n: TreeNode): Record<string, string> => Object.fromEntries(n.properties.map((p) => [p.key, p.value]));

  // The Arkiv node is the only top node
  assert.equal(loaded.roots.length, 1);
  const arkivNode = loaded.roots[0]!;
  assert.deepEqual([arkivNode.type.code, arkivNode.title, arkivNode.reference_code], ['arkiv', 'Testförvaltningen 2001 - 2010', null]);
  assert.deepEqual(values(arkivNode), {
    historik: 'Historik för\nTestförvaltningen.\n\nFörteckning upprättad som testdata.',
    anmarkning: 'Arkivbildaren bytte namn 2005.',
  });
  console.log('✓ Arkiv node at the top, with Historik and Anmärkning');

  const series = arkivNode.children;
  assert.deepEqual(series.map((n) => [n.type.code, n.reference_code, n.title, n.children.length]),
    [['serie', 'A1', 'Styrelsens protokoll', 3], ['serie', 'F2CC', 'Kursdossiéer', 1]], 'series under the arkiv, flat and in file order');

  const a1 = series[0]!;
  assert.deepEqual(values(a1), {
    tid: '2001 -- 2010', omfang: '3 vol.', placering: 'Källaren 15',
    anmarkning: 'Serien i arkivboxar. Serien avslutad.', titel_etikett: 'Styrelsens protokoll 2001-2010.',
  });
  assert.equal(values(series[1]!).titel_etikett, undefined, 'a label equal to the title is not stored twice');

  const [v1, v2, v0] = a1.children;
  assert.ok(v1 && v2 && v0);
  assert.deepEqual([v1.reference_code, v1.title, v1.type.code], ['1', '1', 'volym'], 'a volume is named after its number');
  assert.deepEqual(values(v1), { tid: '2001', placering: 'Källaren', anmarkning: 'Januari - juni.' });
  assert.equal(values(v2).tid, '2002--2009', 'free-text dates are kept as written');
  assert.equal(values(v2).anmarkning, 'Protokoll & bilagor.\n\nBilaga 3 saknas.\nSe volym 0.a.', 'entities decoded, CR removed, <p> = paragraph');
  assert.deepEqual([v0.reference_code, values(v0)], ['0.a', { tid: '2010-' }], 'an empty <odd> gives no value');
  assert.deepEqual([a1.valid_from, a1.valid_to], [null, null]);
  console.log('✓ fields: Tid, Omfång, Placering, Anmärkning, differing title label');

  const job = await knex('transfer_jobs').where({ structure_id: imported.id, direction: 'import' }).first();
  assert.deepEqual([job.format, job.status, job.node_count, job.file_name], ['ra-ead', 'done', 7, 'ra-ead-sample.ead']);
  console.log('✓ logged in transfer_jobs with format ra-ead');

  // 2. Same eadid and arkivbildare, another arkiv
  await assert.rejects(service.import(sample), EadImportConflictError);
  const other = sample.replaceAll('Testförvaltningen 2001 - 2010', 'Testfakulteten 2001 - 2010');
  const second = await service.import(other, { sourceFileName: 'other.ead' });
  assert.ok(second.archive);
  assert.equal(second.archive.created, true);
  assert.equal(second.archive.creatorCreated, false, 'the arkivbildare from the first file is reused');
  assert.equal(second.archive.creatorId, result.archive.creatorId);
  assert.deepEqual(second.createdNodeTypes, [], 'Serie and Volym are reused');
  assert.deepEqual(second.warnings, []);
  console.log('✓ same file refused (409); a second arkiv of the same arkivbildare is imported');

  // archiveId given: the file's own arkiv is not created
  const third = await service.import(sample.replaceAll('Testförvaltningen 2001 - 2010', 'Testnämnden 2001 - 2010'),
    { archiveId: result.archive.id });
  assert.equal(third.archive, undefined);
  assert.equal(await count(knex, 'archive_structures', { archive_id: result.archive.id }), 2);
  console.log('✓ archiveId overrides the arkiv in the file');

  // 3. Export
  const ead3 = buildEad3(loaded, { generatedAt: new Date('2026-11-13T12:00:00Z') });
  assert.match(ead3, /<archdesc level="fonds">/);
  assert.equal((ead3.match(/level="fonds"/g) || []).length, 1, 'the Arkiv node is the archdesc, not also a <c>');
  assert.match(ead3, /<custodhist localtype="historik">/);
  assert.match(ead3, /<corpname>\s*<part>Testhögskolan 2001-2010<\/part>/);
  assert.match(ead3, /<unitdate label="Tid">2001 -- 2010<\/unitdate>/);
  if (process.env.EAD3_XSD) {
    const file = path.join(process.env.OUT_DIR || '.', 'ra-ead-sample.ead3.xml');
    fs.writeFileSync(file, ead3);
    execFileSync('xmllint', ['--noout', '--schema', process.env.EAD3_XSD, file], { stdio: 'inherit' });
    console.log('✓ EAD3 export of the imported arkivförteckning is valid against the XSD');
  } else {
    console.log('  (skipped XSD validation – set EAD3_XSD)');
  }

  const raEad = buildRaEad(loaded, { generatedAt: new Date('2026-11-13T12:00:00Z') });
  assert.match(raEad, /<ead xmlns="http:\/\/xml\.ra\.se\/EAD"/);
  assert.match(raEad, /<eadid>77<\/eadid>/);
  assert.match(raEad, /<corpname authfilenumber="\/77" role="arkivbildare">Testhögskolan 2001-2010<\/corpname>/);
  assert.match(raEad, /<unittitle label="Styrelsens protokoll 2001-2010\.">Styrelsens protokoll<\/unittitle>/);
  assert.match(raEad, /<extent unit="vol\.">3<\/extent>/);
  assert.equal((raEad.match(/level="fonds"/g) || []).length, 1, 'the Arkiv node is the archdesc, not also a <c>');
  assert.match(raEad, /<custodhist>\s*<p>Historik för/);
  assert.doesNotMatch(raEad, /<unittitle[^>]*>1<\/unittitle>/, 'a volume gets no <unittitle>');

  // Round trip in an empty database: the exported file gives the same tree, arkiv and arkivbildare
  const knex2 = await freshDb();
  const again = await new EadImportService(knex2).import(raEad);
  const reloaded = await loadStructure(knex2, again.structures[0]!.id);
  assert.ok(reloaded);
  assert.deepEqual(summary(reloaded.roots), summary(loaded.roots));
  assert.equal(reloaded.archive?.name, loaded.archive?.name);
  assert.equal(reloaded.archive?.description, loaded.archive?.description);
  assert.equal(reloaded.archive?.creator?.name, loaded.archive?.creator?.name);
  assert.equal(reloaded.archive?.creator?.external_id, '/77');
  assert.deepEqual(again.warnings.filter((w) => !w.startsWith('Nya nodtyper')), []);
  await knex2.destroy();
  console.log('✓ RA-EAD export, imported again: same nodes, fields, arkiv and arkivbildare');


  await knex.destroy();
  console.log('\nAll RA-EAD tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
