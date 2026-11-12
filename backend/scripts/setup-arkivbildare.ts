/**
 * Developer tool (not part of the app): puts the arkivbildare in a database that was filled
 * by importing KS_IHP.ead3 instead of by the demo seed, and links structures to Malmö universitet.
 *
 *   npx tsx scripts/setup-arkivbildare.ts            lists structures without an arkivbildare
 *   npx tsx scripts/setup-arkivbildare.ts 1          links structure 1 to Malmö universitet
 *   npx tsx scripts/setup-arkivbildare.ts 1 2        links structures 1 and 2
 *
 * Safe to run more than once: nothing that already exists is created again.
 * Names and codes are the same as in seeds/01_demo.js. Does NOT delete anything
 * (unlike `npm run seed`, which empties every table first).
 */
import knexLib, { type Knex } from 'knex';
import knexConfig from '../knexfile';

const MAU = { name: 'Malmö universitet' };
const MAH = {
  name: 'Malmö högskola 1998–2015',
  start_year: 1998,
  end_year: 2015,
  description: 'Föregångare till Malmö universitet. Arkivförteckningarna (GV, LS) importeras senare.',
};
const MAU_ARCHIVE = { reference_code: 'MAU-001', name: 'Malmö universitets arkiv' };

export interface SetupReport {
  created: string[];
  linked: number[];
  alreadyLinked: number[];
}

/** Creates the two arkivbildare and MAU's archive if missing, then links the given structures. */
export async function setupArchiveCreators(knex: Knex, structureIds: number[]): Promise<SetupReport> {
  return knex.transaction(async (trx) => {
    const report: SetupReport = { created: [], linked: [], alreadyLinked: [] };

    const missing = await findMissingStructures(trx, structureIds);
    if (missing.length > 0) {
      throw new Error(`Strukturen finns inte: ${missing.join(', ')}`);
    }

    const mauId = await findOrCreate(trx, 'archive_creators', { name: MAU.name }, { ...MAU, is_published: true }, report);
    await findOrCreate(trx, 'archive_creators', { name: MAH.name }, { ...MAH, is_published: true }, report);
    const archiveId = await findOrCreate(
      trx,
      'archives',
      { reference_code: MAU_ARCHIVE.reference_code },
      { ...MAU_ARCHIVE, archive_creator_id: mauId, is_published: true },
      report,
    );

    for (const structureId of structureIds) {
      const link = await trx('archive_structures').where({ archive_id: archiveId, structure_id: structureId }).first('id');
      if (link) {
        report.alreadyLinked.push(structureId);
      } else {
        await trx('archive_structures').insert({ archive_id: archiveId, structure_id: structureId });
        report.linked.push(structureId);
      }
    }
    return report;
  });
}

/** Structures that are not linked to any archive, i.e. not shown under an arkivbildare. */
export async function findUnlinkedStructures(
  knex: Knex,
): Promise<Array<{ id: number; name: string; structure_type: string }>> {
  return knex('structures')
    .whereNotIn('id', knex('archive_structures').select('structure_id'))
    .select('id', 'name', 'structure_type')
    .orderBy('id');
}

async function findMissingStructures(trx: Knex.Transaction, structureIds: number[]): Promise<number[]> {
  const found = await trx('structures').whereIn('id', structureIds).pluck('id');
  return structureIds.filter((id) => !found.includes(id));
}

async function findOrCreate(
  trx: Knex.Transaction,
  table: string,
  match: Record<string, unknown>,
  row: Record<string, unknown>,
  report: SetupReport,
): Promise<number> {
  const existing = await trx(table).where(match).first('id');
  if (existing) {
    return existing.id as number;
  }
  const [created] = await trx(table).insert(row, ['id']);
  report.created.push(`${table}: ${String(row.name)}`);
  return created.id as number;
}

async function main(): Promise<void> {
  const knex = knexLib(knexConfig.development!);
  try {
    const ids = process.argv.slice(2).map(Number);
    if (ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      const unlinked = await findUnlinkedStructures(knex);
      console.log('Strukturer utan arkivbildare:');
      unlinked.forEach((s) => console.log(`  ${s.id}  ${s.name}  (${s.structure_type})`));
      console.log('\nKör: npx tsx scripts/setup-arkivbildare.ts <id> [<id> ...]');
      return;
    }
    const report = await setupArchiveCreators(knex, ids);
    console.log('Skapat:', report.created.length ? report.created.join('; ') : 'inget (fanns redan)');
    console.log('Kopplade till Malmö universitet:', report.linked.join(', ') || '-');
    console.log('Var redan kopplade:', report.alreadyLinked.join(', ') || '-');
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
