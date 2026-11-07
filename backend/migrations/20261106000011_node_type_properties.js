/**
 * 011 – fields as one shared list, linked to node types
 *       (Klara's stödtabell "Beskrivningsfält")
 *
 * Background: the doc "WIIT – Fält och nodtyper jämfört med Klaras beskrivningsfält"
 * (2026-11-06). In Klara one field can be ticked for several object types, e.g.
 * "Överlämnande av arkiv …" belongs to both Arkivbildare and Arkiv. Until now
 * property_definitions.node_type_id tied every field to exactly ONE node type, so the
 * same field had to be entered once per node type and the copies could drift apart.
 *
 * 1. node_type_properties – which node types have which field. sort_order and
 *    is_required move here, because they can differ between node types
 *    (a field can be number 1 on Arkivbildare and number 5 on Arkiv).
 *
 * 2. Today's links are copied over: one row per field, so nothing changes for the user.
 *
 * 3. The same key on several node types (the EAD import creates fields per node type):
 *    - identical fields (same label, data_type, ead_element, is_public, is_repeatable,
 *      is_active, help_text) are merged into the oldest one; values and choices are moved;
 *    - fields that differ keep their own row and get the node type code added to the key
 *      (placering → placering_arkivbox), so no field silently changes meaning.
 *
 * 4. property_definitions loses node_type_id, sort_order and is_required.
 *    key becomes unique: one field = one key.
 *
 * 5. New columns from Klara's Beskrivningsfält:
 *      group_label    Grupperingsrubrik – heading that groups fields on the object
 *      default_value  Standardvärde – value suggested when the field is empty
 *      inherits       Ärver – the value can come from the parent (not used by the API yet)
 *
 * 6. Fixed fields that Klara has on Strukturenhet and Handlingstyp (Allmänt tab):
 *      short_name         Kortnamn
 *      public_name        Publika namn
 *      short_description  Kort beskrivning
 *      is_under_work      Under arbete
 *    Tidigare beteckning (previous_reference_code) and the structure's Version
 *    already exist since 007.
 *
 * NOT in this migration – waiting for decisions:
 *   - Eget / Publicerad per value on node_property_values
 *   - handlingsslag merged into Process (alternative A or B)
 *   - gallringsfrist as number + unit, and Publicerad as a list (Externt …)
 */

const FIELD_ATTRS = ['label', 'data_type', 'ead_element', 'is_public', 'is_repeatable', 'is_active', 'help_text'];
const KEY_MAX = 100;

/** MSSQL returns BIT as true/false, SQLite as 1/0; text may be null or ''. */
const same = (a, b) => FIELD_ATTRS.every((k) => {
  const x = a[k], y = b[k];
  if (typeof x === 'boolean' || typeof y === 'boolean' || typeof x === 'number' || typeof y === 'number') {
    return Boolean(x) === Boolean(y);
  }
  return (x ?? '') === (y ?? '');
});

exports.up = async function (knex) {

  // 1. node_type_properties
  await knex.schema.createTable('node_type_properties', (t) => {
    t.integer('node_type_id').notNullable()
      .references('id').inTable('node_types').onDelete('NO ACTION');
    t.integer('property_definition_id').notNullable()
      .references('id').inTable('property_definitions').onDelete('NO ACTION');
    t.integer('sort_order').notNullable().defaultTo(0);   // order of the fields on THIS node type
    t.boolean('is_required').notNullable().defaultTo(false);
    t.primary(['node_type_id', 'property_definition_id'], 'pk_node_type_properties');
    // The primary key starts with node_type_id; the other foreign key needs its own index (008, point 8)
    t.index(['property_definition_id'], 'ix_node_type_properties_definition');
  });

  // 2. Copy existing links
  const defs = await knex('property_definitions as d')
    .join('node_types as t', 't.id', 'd.node_type_id')
    .select('d.*', 't.code as type_code')
    .orderBy('d.id');

  const links = defs.map((d) => ({
    node_type_id: d.node_type_id,
    property_definition_id: d.id,
    sort_order: d.sort_order ?? 0,
    is_required: Boolean(d.is_required),
  }));
  if (links.length) await knex.batchInsert('node_type_properties', links, 100);

  // 3. Same key on several node types: merge identical fields, rename the others
  const usedKeys = new Set(defs.map((d) => d.key.toLowerCase()));   // MSSQL compares case-insensitively
  const byKey = new Map();
  for (const d of defs) {
    const k = d.key.toLowerCase();
    byKey.set(k, [...(byKey.get(k) ?? []), d]);
  }

  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const [kept, ...others] = group;   // ordered by id → the oldest field is kept

    for (const d of others) {
      if (same(kept, d)) {
        // A node has one node type, and the two fields belonged to different node types,
        // so no node has values in both – moving the values cannot collide.
        await knex('node_property_values').where({ property_definition_id: d.id })
          .update({ property_definition_id: kept.id });
        await knex('node_type_properties').where({ property_definition_id: d.id })
          .update({ property_definition_id: kept.id });

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
      } else {
        const base = `${d.key}_${d.type_code}`.slice(0, KEY_MAX);
        let key = base;
        for (let i = 2; usedKeys.has(key.toLowerCase()); i++) key = `${base.slice(0, KEY_MAX - 4)}_${i}`;
        usedKeys.add(key.toLowerCase());
        await knex('property_definitions').where({ id: d.id }).update({ key });
      }
    }
  }


  // 4. property_definitions without node_type_id, sort_order, is_required
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
  });
  await knex.schema.alterTable('property_definitions', (t) => {
    t.unique(['key'], { indexName: 'uq_property_definitions_key', useConstraint: true });
  });

  // 5. Klara's Beskrivningsfält: Grupperingsrubrik, Standardvärde, Ärver
  await knex.schema.alterTable('property_definitions', (t) => {
    t.string('group_label', 255);
    t.text('default_value');
    t.boolean('inherits').notNullable().defaultTo(false);
  });

  // 6. Fixed fields on the node (Klara's Allmänt tab)
  await knex.schema.alterTable('nodes', (t) => {
    t.string('short_name', 255);
    t.string('public_name', 500);
    t.string('short_description', 1000);
    t.boolean('is_under_work').notNullable().defaultTo(false);
  });
};

exports.down = async function (knex) {
  // m6
  await knex.schema.alterTable('nodes', (t) => {
    t.dropColumn('is_under_work');
    t.dropColumn('short_description');
    t.dropColumn('public_name');
    t.dropColumn('short_name');
  });

  // 5
  await knex.schema.alterTable('property_definitions', (t) => {
    t.dropColumn('inherits');
    t.dropColumn('default_value');
    t.dropColumn('group_label');
  });

  // 4 – back to one node type per field. Columns are nullable until every field has its type.
  await knex.raw('ALTER TABLE property_definitions DROP CONSTRAINT uq_property_definitions_key');
  await knex.schema.alterTable('property_definitions', (t) => {
    t.integer('node_type_id');
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_required').notNullable().defaultTo(false);
  });

  const defs = await knex('property_definitions').orderBy('id');
  for (const d of defs) {
    const links = await knex('node_type_properties')
      .where({ property_definition_id: d.id }).orderBy('node_type_id');

    // A value on a node type without a link (e.g. the link was removed) still needs a field.
    // Not distinct() + pluck(): on MSSQL that selects the column twice and returns an array.
    const valueTypes = (await knex('node_property_values as v')
      .join('nodes as n', 'n.id', 'v.node_id')
      .where('v.property_definition_id', d.id)
      .distinct('n.node_type_id as node_type_id'))
      .map((r) => Number(r.node_type_id));
    for (const typeId of valueTypes) {
      if (!links.some((l) => l.node_type_id === typeId)) {
        links.push({ node_type_id: typeId, property_definition_id: d.id, sort_order: 0, is_required: false });
      }
    }

    if (links.length === 0) {
      // Not used by any node type and has no values – cannot exist in the old model
      await knex('property_options').where({ property_definition_id: d.id }).del();
      await knex('property_definitions').where({ id: d.id }).del();
      continue;
    }

    const [first, ...rest] = links;
    await knex('property_definitions').where({ id: d.id })
      .update({ node_type_id: first.node_type_id, sort_order: first.sort_order, is_required: first.is_required });

    // One copy per extra node type; that node type's values and the choices go with it
    for (const l of rest) {
      const { id: _id, ...row } = d;
      const [created] = await knex('property_definitions').insert({
        ...row, node_type_id: l.node_type_id, sort_order: l.sort_order, is_required: l.is_required,
      }, ['id']);
      const copyId = typeof created === 'object' ? created.id : created;

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

  // 1–3 – merged and renamed keys are not split back; the fields still work under their new keys
  await knex.schema.dropTableIfExists('node_type_properties');
};
