/**
 * 013 – fields shared between node types, tabs as data, heltal as a value type
 *       (Klara's stödtabell "Beskrivningsfält")
 *
 * Why: kunden said on 2026-11-10 that
 *   - one field can apply to several levels (in Klara you tick object types per field),
 *   - the value types are text, heltal, Ja/Nej and decimal,
 *   - admins want to add and change tabs and fields themselves (under Inställningar).
 *
 * Until now property_definitions.node_type_id tied every field to exactly ONE node type.
 * Kortnamn existed once per level (verksamhetsområde, processgrupp, process, handlingsslag,
 * handlingstyp) and the copies could drift apart. The tabs were a CHECK constraint (011) and
 * the same list again in the code (TAB_LABELS), so a new tab needed a migration and a deploy.
 *
 * 1. property_tabs – one row per tab. tab_key now points here instead of a CHECK list.
 *      kind  what the tab shows. Only 'fields' is drawn from field rows; the other kinds
 *            need code to be drawn, so that list stays fixed:
 *              fields      fields and tables of fields   (Allmänt, Beskrivning, Referenser …)
 *              activities  node_activities (011)         (Aktiviteter)
 *              children    a list of the child nodes     (Handlingstyper)
 *              diagram     –                             (Diagram)
 *            A tab an admin adds is always 'fields' (checked by the API, not here).
 *
 * 2. 'integer' as data_type. Stored in value_number like 'number'; the API checks it is
 *    a whole number.
 *
 * 3. node_type_properties – which node types have which field, and WHERE on that node type.
 *    Placement moves here from the field, because the same field sits differently per level:
 *    in seed 02 Kortnamn is on the Handlingsslag tab as "Kortnamn, handlingsslag" for a
 *    handlingsslag, and on Allmänt as "Kortnamn" for a handlingstyp.
 *      tab_key, group_key, sort_order, is_required   moved from property_definitions
 *      label_override                                 other label on this node type (NULL = the field's)
 *
 * 4. Today's links are copied over: one row per field, so nothing changes for the user.
 *
 * 5. The same key on several node types (seed 02 and the EAD import create fields per type):
 *    - fields that mean the same (same data_type, ead_element, is_public, is_repeatable,
 *      is_active, help_text, has_own_published) are merged into the oldest one. Values and
 *      choices move. A different label is kept as label_override on that node type;
 *    - fields that differ keep their own row and get the node type code added to the key
 *      (gallringsfrist becomes gallringsfrist_handlingstyp), so no field silently changes meaning;
 *    - if some node has values in both fields (should not happen, but nothing prevented it),
 *      they are not merged either.
 *
 * 6. A value whose field is not linked to the node's type gets a link (tab Allmänt, last),
 *    so no saved value disappears from the form.
 *
 * 7. property_definitions loses node_type_id, sort_order, is_required, tab_key, group_key.
 *    key becomes unique: one field = one key.
 *
 * NOT in this migration (see the doc "migration-013" in the WIIT project):
 *   - node_type_tabs (which tabs a node type shows) and removing node_types.has_activities
 *   - format / ead_wrapper on structure_types
 *   - Grupperingsrubrik, Standardvärde, Ärver, is_system
 *
 * SQL Server only, like 003–012. Run migrate, migrate:rollback, migrate on the Docker database.
 */

const TABS = [
  { key: 'allmant',        label: 'Allmänt',        kind: 'fields',     sort_order: 1 },
  { key: 'handlingsslag',  label: 'Handlingsslag',  kind: 'fields',     sort_order: 2 },
  { key: 'handlingstyper', label: 'Handlingstyper', kind: 'children',   sort_order: 3 },
  { key: 'aktiviteter',    label: 'Aktiviteter',    kind: 'activities', sort_order: 4 },
  { key: 'diagram',        label: 'Diagram',        kind: 'diagram',    sort_order: 5 },
  { key: 'beskrivning',    label: 'Beskrivning',    kind: 'fields',     sort_order: 6 },
  { key: 'referenser',     label: 'Referenser',     kind: 'fields',     sort_order: 7 },
];
const TAB_KINDS = ['fields', 'activities', 'children', 'diagram'];
const DEFAULT_TAB = 'allmant';

const DATA_TYPES_012 = ['text', 'longtext', 'number', 'date', 'boolean', 'url', 'enum'];
const DATA_TYPES_013 = [...DATA_TYPES_012, 'integer'];

/** What makes two fields "the same field". The label is not here: it can differ per node type. */
const FIELD_ATTRS = ['data_type', 'ead_element', 'is_public', 'is_repeatable', 'is_active', 'help_text', 'has_own_published'];
const KEY_MAX = 100;
/** sort_order for links created in step 6: after the fields the archivist placed. */
const LATE = 1000;

const list = (values) => values.map((v) => `'${v}'`).join(',');

/** MSSQL returns BIT as true/false, SQLite as 1/0; text may be null or ''. */
const same = (a, b) => FIELD_ATTRS.every((k) => {
  const x = a[k], y = b[k];
  if (typeof x === 'boolean' || typeof y === 'boolean' || typeof x === 'number' || typeof y === 'number') {
    return Boolean(x) === Boolean(y);
  }
  return (x ?? '') === (y ?? '');
});

const idOf = (row) => (typeof row === 'object' ? row.id : row);


// ── Data steps 4–6. Plain query builder, so they also run on SQLite (for testing). ──────────

/** 4. One link per existing field. Call while property_definitions still has node_type_id. */
async function copyLinks(knex) {
  const defs = await knex('property_definitions').orderBy('id');
  const links = defs.map((d) => ({
    node_type_id: d.node_type_id,
    property_definition_id: d.id,
    tab_key: d.tab_key || DEFAULT_TAB,
    group_key: d.group_key ?? null,
    sort_order: d.sort_order ?? 0,
    is_required: Boolean(d.is_required),
    label_override: null,
  }));
  if (links.length) await knex.batchInsert('node_type_properties', links, 100);
}

/** 5. Same key on several node types: merge the fields that mean the same, rename the others. */
async function mergeSameKeys(knex) {
  const defs = await knex('property_definitions as d')
    .join('node_types as t', 't.id', 'd.node_type_id')
    .select('d.*', 't.code as type_code')
    .orderBy('d.id');

  const usedKeys = new Set(defs.map((d) => d.key.toLowerCase()));   // MSSQL compares case-insensitively
  const byKey = new Map();
  for (const d of defs) {
    const k = d.key.toLowerCase();
    byKey.set(k, [...(byKey.get(k) ?? []), d]);
  }

  const report = { merged: [], renamed: [] };

  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const [kept, ...others] = group;   // ordered by id: the oldest field is kept

    for (const d of others) {
      // Two fields of different node types should never both have values on the same node.
      // If they do, merging would break uq_node_property_values_node_def_order, so keep both.
      const clash = await knex('node_property_values')
        .whereIn('property_definition_id', [kept.id, d.id])
        .groupBy('node_id')
        .havingRaw('COUNT(DISTINCT property_definition_id) > 1')
        .select('node_id')
        .first();

      if (same(kept, d) && !clash) {
        await knex('node_property_values').where({ property_definition_id: d.id })
          .update({ property_definition_id: kept.id });
        // (node_type_id, key) was unique, so kept is not linked to d's node type yet: no clash
        await knex('node_type_properties').where({ property_definition_id: d.id })
          .update({
            property_definition_id: kept.id,
            label_override: d.label === kept.label ? null : d.label,
          });

        // Choices: move the ones the kept field lacks, drop the rest (unique per field, 009)
        const keptValues = new Set((await knex('property_options')
          .where({ property_definition_id: kept.id }).pluck('value')).map((v) => v.toLowerCase()));
        for (const o of await knex('property_options').where({ property_definition_id: d.id })) {
          if (keptValues.has(o.value.toLowerCase())) {
            await knex('property_options').where({ id: o.id }).del();
          } else {
            await knex('property_options').where({ id: o.id }).update({ property_definition_id: kept.id });
            keptValues.add(o.value.toLowerCase());
          }
        }
        await knex('property_definitions').where({ id: d.id }).del();
        report.merged.push(`${d.key} (${d.type_code}) into ${kept.key} (${kept.type_code})`);
      } else {
        const base = `${d.key}_${d.type_code}`.slice(0, KEY_MAX);
        let key = base;
        for (let i = 2; usedKeys.has(key.toLowerCase()); i++) key = `${base.slice(0, KEY_MAX - 4)}_${i}`;
        usedKeys.add(key.toLowerCase());
        await knex('property_definitions').where({ id: d.id }).update({ key });
        report.renamed.push(`${d.key} (${d.type_code}) renamed ${key}`);
      }
    }
  }
  return report;
}

/** 6. Every (node type, field) that has values also has a link. */
async function linkFieldsWithValues(knex) {
  const missing = await knex('node_property_values as v')
    .join('nodes as n', 'n.id', 'v.node_id')
    .leftJoin('node_type_properties as l', function () {
      this.on('l.node_type_id', '=', 'n.node_type_id')
        .andOn('l.property_definition_id', '=', 'v.property_definition_id');
    })
    .whereNull('l.node_type_id')
    .distinct('n.node_type_id as node_type_id', 'v.property_definition_id as property_definition_id');

  const rows = missing.map((m) => ({
    node_type_id: Number(m.node_type_id),
    property_definition_id: Number(m.property_definition_id),
    tab_key: DEFAULT_TAB,
    group_key: null,
    sort_order: LATE,
    is_required: false,
    label_override: null,
  }));
  if (rows.length) await knex.batchInsert('node_type_properties', rows, 100);
  return rows.length;
}


exports.up = async function (knex) {

  // 1. property_tabs
  await knex.schema.createTable('property_tabs', (t) => {
    t.string('key', 30).notNullable().primary('pk_property_tabs');   // 'allmant' – what tab_key holds
    t.string('label', 100).notNullable();                             // 'Allmänt' – what the user sees
    t.string('kind', 20).notNullable().defaultTo('fields');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);             // retired, never deleted
    t.check(`?? IN (${list(TAB_KINDS)})`, ['kind'], 'ck_property_tabs_kind');
  });
  await knex('property_tabs').insert(TABS.map((tab) => ({ ...tab, is_active: true })));

  // 2. 'integer' as data type
  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT ck_property_definitions_data_type');
  await knex.raw(`ALTER TABLE property_definitions ADD CONSTRAINT ck_property_definitions_data_type
    CHECK (data_type IN (${list(DATA_TYPES_013)}))`);

  // 3. node_type_properties
  await knex.schema.createTable('node_type_properties', (t) => {
    t.integer('node_type_id').notNullable()
      .references('id').inTable('node_types').onDelete('NO ACTION');
    t.integer('property_definition_id').notNullable()
      .references('id').inTable('property_definitions').onDelete('NO ACTION');
    t.string('tab_key', 30).notNullable().defaultTo(DEFAULT_TAB)
      .references('key').inTable('property_tabs').onDelete('NO ACTION');
    t.string('group_key', 50);                                 // same group_key = columns of one table
    t.integer('sort_order').notNullable().defaultTo(0);        // order on THIS node type
    t.boolean('is_required').notNullable().defaultTo(false);   // required on THIS node type
    t.string('label_override', 255);                           // NULL = the field's own label
    t.primary(['node_type_id', 'property_definition_id'], 'pk_node_type_properties');
    // The primary key starts with node_type_id; the other foreign keys need their own index (008)
    t.index(['property_definition_id'], 'ix_node_type_properties_definition');
    t.index(['tab_key'], 'ix_node_type_properties_tab');
  });

  // 4–6. Data
  await copyLinks(knex);
  await mergeSameKeys(knex);
  await linkFieldsWithValues(knex);

  // 7. property_definitions without the columns that moved
  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT ck_property_definitions_tab');
  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT uq_property_definitions_type_key');
  await knex.raw('DROP INDEX ix_property_definitions_node_type ON property_definitions');
  // The foreign key was named by Knex in 003; look the name up instead of guessing it
  await knex.raw(`
    DECLARE @fk sysname = (
      SELECT TOP 1 fk.name
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
      WHERE fk.parent_object_id = OBJECT_ID('property_definitions') AND c.name = 'node_type_id');
    IF @fk IS NOT NULL EXEC('ALTER TABLE property_definitions DROP CONSTRAINT [' + @fk + ']');
  `);
  await knex.schema.alterTable('property_definitions', (t) => {
    t.dropColumn('node_type_id');   // Knex drops the DEFAULT constraints of the columns first
    t.dropColumn('sort_order');
    t.dropColumn('is_required');
    t.dropColumn('tab_key');
    t.dropColumn('group_key');
  });
  await knex.schema.alterTable('property_definitions', (t) => {
    t.unique(['key'], { indexName: 'uq_property_definitions_key', useConstraint: true });
  });
};


exports.down = async function (knex) {
  // 7 – back to one node type per field. node_type_id is nullable until every field has one.
  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT uq_property_definitions_key');
  await knex.schema.alterTable('property_definitions', (t) => {
    t.integer('node_type_id');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_required').notNullable().defaultTo(false);
    t.string('tab_key', 30);
    t.string('group_key', 50);
  });

  const oldTabs = new Set(TABS.map((tab) => tab.key));
  const tabOf = (key) => (oldTabs.has(key) ? key : null);   // a tab an admin added cannot exist in 011

  const defs = await knex('property_definitions').orderBy('id');
  for (const d of defs) {
    const links = await knex('node_type_properties')
      .where({ property_definition_id: d.id }).orderBy('node_type_id');

    // A value on a node type without a link still needs a field.
    // Not distinct() + pluck(): on MSSQL that selects the column twice and returns an array.
    const valueTypes = (await knex('node_property_values as v')
      .join('nodes as n', 'n.id', 'v.node_id')
      .where('v.property_definition_id', d.id)
      .distinct('n.node_type_id as node_type_id'))
      .map((r) => Number(r.node_type_id));
    for (const typeId of valueTypes) {
      if (!links.some((l) => Number(l.node_type_id) === typeId)) {
        links.push({ node_type_id: typeId, property_definition_id: d.id, tab_key: null, group_key: null,
          sort_order: LATE, is_required: false, label_override: null });
      }
    }

    if (links.length === 0) {
      // Not used by any node type and has no values – cannot exist in the old model
      await knex('property_options').where({ property_definition_id: d.id }).del();
      await knex('property_definitions').where({ id: d.id }).del();
      continue;
    }

    const placed = (l) => ({
      node_type_id: l.node_type_id,
      label: l.label_override || d.label,
      sort_order: l.sort_order,
      is_required: Boolean(l.is_required),
      tab_key: tabOf(l.tab_key),
      group_key: l.group_key ?? null,
    });

    const [first, ...rest] = links;
    await knex('property_definitions').where({ id: d.id }).update(placed(first));

    // One copy per extra node type; that node type's values and the choices go with it
    for (const l of rest) {
      const { id: _id, ...row } = d;
      const copyId = idOf((await knex('property_definitions').insert({ ...row, ...placed(l) }, ['id']))[0]);

      const nodeIds = knex('nodes').where({ node_type_id: l.node_type_id }).select('id');
      await knex('node_property_values')
        .where({ property_definition_id: d.id }).whereIn('node_id', nodeIds)
        .update({ property_definition_id: copyId });

      const options = await knex('property_options').where({ property_definition_id: d.id });
      if (options.length) {
        await knex('property_options').insert(options.map(({ id: _o, ...o }) => ({ ...o, property_definition_id: copyId })));
      }
    }
  }

  await knex.schema.alterTable('property_definitions', (t) => {
    t.integer('node_type_id').notNullable().alter();
  });
  await knex.schema.alterTable('property_definitions', (t) => {
    t.foreign('node_type_id', 'fk_property_definitions_node_type')
      .references('id').inTable('node_types').onDelete('NO ACTION');
    t.unique(['node_type_id', 'key'], { indexName: 'uq_property_definitions_type_key', useConstraint: true });
    t.index(['node_type_id'], 'ix_property_definitions_node_type');
  });
  await knex.raw(`ALTER TABLE property_definitions ADD CONSTRAINT ck_property_definitions_tab
    CHECK (tab_key IS NULL OR tab_key IN (${list([...oldTabs])}))`);

  // 3
  await knex.schema.dropTableIfExists('node_type_properties');

  // 2 – heltal fields become decimal fields; the values are already in value_number
  await knex('property_definitions').where({ data_type: 'integer' }).update({ data_type: 'number' });
  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT ck_property_definitions_data_type');
  await knex.raw(`ALTER TABLE property_definitions ADD CONSTRAINT ck_property_definitions_data_type
    CHECK (data_type IN (${list(DATA_TYPES_012)}))`);

  // 1
  await knex.schema.dropTableIfExists('property_tabs');

  // 5–6 – merged and renamed keys are not split back; the fields still work under their new keys
};

// For test/migration013.test.ts only (the DDL above is SQL Server only, the data steps are not)
exports._dataSteps = { copyLinks, mergeSameKeys, linkFieldsWithValues, TABS };
