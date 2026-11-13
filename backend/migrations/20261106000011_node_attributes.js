/**
 * 011 – attributes per node level (tabs, tables, Eget/Publicerad, activities)
 *
 * property_definitions
 *   tab_key            tab the field is shown in ('allmant', 'beskrivning', 'referenser' …)
 *   group_key          fields with the same group_key are the columns of ONE table
 *   has_own_published  row "Värde | Eget (checkbox) | Publicerad (text box)"
 *
 * node_property_values
 *   is_own             the Eget checkbox (meaning not yet known – stored as given)
 *   published_text     the Publicerad text box (filled in by the user)
 *
 * node_activities / node_activity_handlingstyp
 *   The Aktiviteter tab of a process. Each activity has a name, a description, an optional
 *   reference to a strukturenhet with a text box beside it, and a checklist of handlingstyper.
 *   No unique constraint on handlingstyp: the same handlingstyp may be ticked in several activities.
 *
 * Förvaringstabell needs no table: it is node_relations of type 'forvaras_i' (migration 004).
 * All changes are additive; new columns are nullable.
 */

const TABS = ['allmant', 'handlingsslag', 'handlingstyper', 'aktiviteter', 'diagram', 'beskrivning', 'referenser'];

exports.up = async function (knex) {
  await knex.schema.alterTable('property_definitions', (t) => {
    t.string('tab_key', 30);
    t.string('group_key', 50);
    t.boolean('has_own_published').notNullable().defaultTo(false);
  });
  await knex.raw(`
    ALTER TABLE property_definitions ADD CONSTRAINT ck_property_definitions_tab
      CHECK (tab_key IS NULL OR tab_key IN (${TABS.map((t) => `'${t}'`).join(',')}))
  `);

  await knex.schema.alterTable('node_property_values', (t) => {
    t.boolean('is_own');
    t.text('published_text');
  });

  await knex.schema.createTable('node_activities', (t) => {
    t.increments('id').primary();
    t.integer('node_id').notNullable()
      .references('id').inTable('nodes').onDelete('CASCADE');
    t.string('name', 500).notNullable();
    t.text('description');
    t.integer('structure_unit_node_id')
      .references('id').inTable('nodes').onDelete('NO ACTION');   // API checks node_type = 'strukturenhet'
    t.string('structure_unit_text', 500);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.index(['node_id', 'sort_order'], 'ix_node_activities_node');
  });

  await knex.schema.createTable('node_activity_handlingstyp', (t) => {
    t.integer('activity_id').notNullable()
      .references('id').inTable('node_activities').onDelete('CASCADE');
    t.integer('handlingstyp_node_id').notNullable()
      .references('id').inTable('nodes').onDelete('NO ACTION');   // a handlingstyp in use cannot vanish silently
    t.primary(['activity_id', 'handlingstyp_node_id']);
    t.index(['handlingstyp_node_id'], 'ix_node_activity_handlingstyp_node');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('node_activity_handlingstyp');
  await knex.schema.dropTableIfExists('node_activities');

  await knex.schema.alterTable('node_property_values', (t) => {
    t.dropColumn('published_text');
    t.dropColumn('is_own');
  });

  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT ck_property_definitions_tab');
  await knex.schema.alterTable('property_definitions', (t) => {
    t.dropColumn('has_own_published');
    t.dropColumn('group_key');
    t.dropColumn('tab_key');
  });
};
