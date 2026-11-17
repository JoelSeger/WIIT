/**
 * 012 – node type flags: can_be_root and has_activities
 *
 * Two rules about node types lived in the code as lists of type codes:
 *   - nodeCreationService.ts  ROOT_TYPES              which types may be the top node of a structure
 *   - nodeActivityService.ts  TYPES_WITH_ACTIVITIES   which types have the Aktiviteter tab
 *
 * Why they were in the code: node_type_rules (migration 002) stores "child type X is allowed
 * under parent type Y". parent_type_id is NOT NULL and part of the primary key, so a rule
 * "X is allowed with NO parent" cannot be stored there. The same goes for activities: there
 * was no place in the database to say which types have them.
 *
 * Why that was a problem:
 *   - ROOT_TYPES had no entry for arkivforteckning, so an Arkiv node could not be created at
 *     the top of an arkivförteckning through the API (only the EAD import could do it).
 *   - The lists match on type codes. A type the EAD import creates gets its code from the name
 *     in the file ("process", or "process_2" if the code is taken), so the rule could silently
 *     stop applying.
 *   - A new root type needed a code change and a new deploy. Node types are DATA (see 009).
 *
 * node_types
 *   can_be_root      this type may be created without a parent (top node of a structure).
 *                    The type's own structure_type already says in WHICH kind of structure,
 *                    so one column is enough – no new table.
 *   has_activities   nodes of this type have the Aktiviteter tab (node_activities, migration 011).
 *
 * Existing rows are filled in from the data, so nothing changes for a database in use:
 *   can_be_root    = every type that already has a top node somewhere, plus the two types the
 *                    old ROOT_TYPES list allowed.
 *   has_activities = every type that already has activities saved, plus 'process'.
 *
 * All changes are additive. Both columns are NOT NULL with default false, so a type created
 * later (seed, import, admin UI) is not a root and has no activities until someone says so.
 */

// The two lists this migration replaces. Only used to fill in existing rows.
const OLD_ROOT_TYPES = ['verksamhetsomrade', 'strukturenhet'];
const OLD_TYPES_WITH_ACTIVITIES = ['process'];

exports.up = async function (knex) {
  await knex.schema.alterTable('node_types', (t) => {
    t.boolean('can_be_root').notNullable().defaultTo(false);
    t.boolean('has_activities').notNullable().defaultTo(false);
  });

  // can_be_root: types that are a top node today (imported Arkiv, Verksamhetsområde …)
  await knex('node_types')
    .whereIn('id', knex('nodes').whereNull('parent_id').distinct('node_type_id'))
    .orWhereIn('code', OLD_ROOT_TYPES)
    .update({ can_be_root: true });

  // has_activities: types whose nodes already have activities
  await knex('node_types')
    .whereIn('id', knex('nodes')
      .whereIn('id', knex('node_activities').distinct('node_id'))
      .distinct('node_type_id'))
    .orWhereIn('code', OLD_TYPES_WITH_ACTIVITIES)
    .update({ has_activities: true });
};

exports.down = async function (knex) {
  // On SQL Server knex drops the default constraints of the columns first
  await knex.schema.alterTable('node_types', (t) => {
    t.dropColumn('has_activities');
    t.dropColumn('can_be_root');
  });
};
