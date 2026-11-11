/**
 * Developer tool (not part of the app): removes ALL structures and their nodes, so an
 * import can be shown again from the start (for example in a demo for kunden).
 *
 *   npx tsx scripts/clear-structures.ts          shows what would be removed, changes nothing
 *   npx tsx scripts/clear-structures.ts --ja     removes it
 *
 * Kept: arkivbildare, arkiv, users, node types, fields (property_definitions) and relation types.
 * So "Koppla till arkiv" on the import page still offers Malmö universitets arkiv.
 * Removed: structures, nodes, field values, relations between nodes, the links archive-structure,
 * versions, import/export log (transfer_jobs) and structure permissions.
 * Runs in one transaction: if something fails, nothing is removed.
 */
import knexLib, { type Knex } from 'knex';
import knexConfig from '../knexfile';

const CONFIRM_FLAG = '--ja';

/** Tables emptied, children before parents (same order as seeds/01_demo.js). */
const TABLES_TO_EMPTY = [
  'transfer_jobs',
  'structure_versions',
  'ad_group_roles',
  'node_relations',
  'node_property_values',
  'archive_structures',
] as const;

export interface ClearReport {
  structures: number;
  nodes: number;
  [table: string]: number;
}

/** Counts what clearStructures would remove. Changes nothing. */
export async function countStructureData(knex: Knex): Promise<ClearReport> {
  const report: ClearReport = {
    structures: await count(knex, 'structures'),
    nodes: await count(knex, 'nodes'),
  };
  for (const table of TABLES_TO_EMPTY) {
    report[table] = await count(knex, table);
  }
  return report;
}

/** Removes all structures and everything that belongs to them, in one transaction. */
export async function clearStructures(knex: Knex): Promise<ClearReport> {
  const report = await countStructureData(knex);
  await knex.transaction(async (trx) => {
    for (const table of TABLES_TO_EMPTY) {
      await trx(table).del();
    }
    await deleteLeavesFirst(trx);
    await trx('structures').update({ previous_structure_id: null });
    await trx('structures').del();
  });
  return report;
}

/** A node with children cannot be removed (F3.4), so leaves go first, level by level. */
async function deleteLeavesFirst(trx: Knex.Transaction): Promise<void> {
  for (;;) {
    if ((await count(trx, 'nodes')) === 0) {
      return;
    }
    await trx('nodes')
      .whereNotIn('id', trx('nodes').whereNotNull('parent_id').select('parent_id'))
      .del();
  }
}

async function count(knex: Knex, table: string): Promise<number> {
  const row = await knex(table).count({ n: '*' }).first();
  return Number(row?.n ?? 0);
}

function printReport(report: ClearReport): void {
  for (const [table, rows] of Object.entries(report)) {
    console.log(`  ${table.padEnd(22)} ${rows}`);
  }
}

async function main(): Promise<void> {
  const knex = knexLib(knexConfig.development!);
  try {
    if (!process.argv.includes(CONFIRM_FLAG)) {
      console.log('Det här skulle tas bort (rader per tabell):');
      printReport(await countStructureData(knex));
      console.log(`\nInget är ändrat. Kör igen med ${CONFIRM_FLAG} för att ta bort.`);
      return;
    }
    const report = await clearStructures(knex);
    console.log('Borttaget:');
    printReport(report);
    console.log('\nArkivbildare och arkiv finns kvar. Ladda om sidan och importera igen.');
  } finally {
    await knex.destroy();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
