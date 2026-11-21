/**
 * Fields per node level, from "Sammanfattning av information som vi behöver för att skapa struktur".
 *
 * Since migration 013 a field is ONE row (property_definitions) that several node types can use.
 * Where it sits on each node type (tab, table, order, label) is its link in node_type_properties.
 * Kortnamn is one field on verksamhetsområde, processgrupp, process, handlingsslag and handlingstyp,
 * with its own label and tab on handlingsslag and handlingstyp.
 *
 * Idempotent:
 *   - a node type that already has the field only gets tab / group / sort_order updated (and
 *     has_own_published on the field), so labels and help texts edited in the admin UI are kept;
 *   - a field that exists on another node type is linked, if it has the same data type. A
 *     different label becomes label_override on this node type;
 *   - a key taken by a field of another data type gets a new field with the node type code
 *     added (like migration 013 does).
 * All fields are optional (is_required = false).
 * Name, Beteckning, Tidigare beteckning, Giltig från/till, Beskrivning and the node type are
 * columns on `nodes`, so they are NOT property definitions.
 *
 * Run after 01_demo.js:  npm run seed
 */

async function upsert(knex, type, def) {
  const placement = {
    tab_key: def.tab_key,
    group_key: def.group_key ?? null,
    sort_order: def.sort_order,
  };
  const dataType = def.data_type ?? 'text';

  // 1. Already on this node type: placement only
  const linked = await knex('property_definitions as d')
    .join('node_type_properties as l', 'l.property_definition_id', 'd.id')
    .where({ 'l.node_type_id': type.id, 'd.key': def.key })
    .first('d.id');
  if (linked) {
    await knex('node_type_properties')
      .where({ node_type_id: type.id, property_definition_id: linked.id }).update(placement);
    if (def.has_own_published) {
      await knex('property_definitions').where({ id: linked.id }).update({ has_own_published: true });
    }
    return;
  }

  // 2. The field exists (on another node type) with the same data type: link it
  let field = await knex('property_definitions').where({ key: def.key }).first();
  let key = def.key;
  if (field && field.data_type !== dataType) {
    key = `${def.key}_${type.code}`;
    field = await knex('property_definitions').where({ key }).first();
  }

  // 3. New field
  if (!field) {
    const [row] = await knex('property_definitions').insert({
      key,
      label: def.label,
      data_type: dataType,
      is_public: def.is_public ?? true,
      is_repeatable: def.is_repeatable ?? false,
      has_own_published: def.has_own_published ?? false,
      ead_element: def.ead_element ?? null,
      help_text: def.help_text ?? null,
      is_active: true,
    }, ['id']);
    field = { id: row.id, label: def.label };
  }

  await knex('node_type_properties').insert({
    node_type_id: type.id,
    property_definition_id: field.id,
    is_required: false,
    label_override: def.label === field.label ? null : def.label,
    ...placement,
  });
}

// Referenser – the same table on every level that has it (columns as in Klara:
// Titel | Filnamn/Länk | Typ | Publicera). Filnamn/Länk is plain text, not 'url': it can hold a file name.
const REFERENCES = [
  { key: 'referens_titel',     label: 'Titel',        data_type: 'text',    sort_order: 91 },
  { key: 'referens_lank',      label: 'Filnamn/Länk', data_type: 'text',    sort_order: 92 },
  { key: 'referens_typ',       label: 'Typ',          data_type: 'text',    sort_order: 93 },
  { key: 'referens_publicera', label: 'Publicera',    data_type: 'boolean', sort_order: 94 },
].map((d) => ({ ...d, tab_key: 'referenser', group_key: 'referens', is_repeatable: true }));

// Allmänt for the three upper levels
const UPPER_GENERAL = [
  { key: 'kortnamn',        label: 'Kort namn',       sort_order: 1 },
  { key: 'publikt_namn',    label: 'Publikt namn',    sort_order: 2 },
  { key: 'kortbeskrivning', label: 'Kortbeskrivning', sort_order: 3, data_type: 'longtext' },
].map((d) => ({ ...d, tab_key: 'allmant' }));

const BY_TYPE = {
  verksamhetsomrade: [...UPPER_GENERAL, ...REFERENCES],
  processgrupp:      [...UPPER_GENERAL, ...REFERENCES],
  process:           [...UPPER_GENERAL, ...REFERENCES],

  // Fields of a handlingsslag node. In Klara they are all on the Handlingsslag tab of the process
  // (Namn, Kortnamn, Gallringsfrist, Beskrivning are nodes columns / fields below), so they all
  // use tab_key 'handlingsslag'. Beskrivningsfält rows = fields with has_own_published
  // (Värde | Eget | Publicerad).
  // TODO: only Informationsägare is visible in the screenshots – add the other Beskrivningsfält rows.
  // TODO: the unit options of Gallringsfrist (the dropdown beside the number) are unknown – text until listed.
  handlingsslag: [
    { key: 'kortnamn',       label: 'Kortnamn, handlingsslag',     sort_order: 1, tab_key: 'handlingsslag' },
    { key: 'publikt_namn',   label: 'Publika handlingsslagsnamn',  sort_order: 2, tab_key: 'handlingsslag' },
    { key: 'gallringsfrist', label: 'Gallringsfrist (värde)',      sort_order: 3, tab_key: 'handlingsslag', data_type: 'integer' },
    { key: 'gallringsfrist_enhet', label: 'Gallringsfrist (enhet)', sort_order: 4, tab_key: 'handlingsslag' },
    { key: 'informationsagare', label: 'Informationsägare',        sort_order: 5, tab_key: 'handlingsslag', has_own_published: true },
  ],

  handlingstyp: [
    // Allmänt
    { key: 'kortnamn',      label: 'Kortnamn',      sort_order: 1, tab_key: 'allmant' },
    { key: 'strukturenhet', label: 'Strukturenhet', sort_order: 2, tab_key: 'allmant' },
    { key: 'tidsperiod',    label: 'Tidsperiod',    sort_order: 3, tab_key: 'allmant' },
    // Gallringsfrist is a whole number plus a unit (8 | År) in Klara, the same fields as on handlingsslag
    { key: 'gallringsfrist', label: 'Gallringsfrist', sort_order: 4, tab_key: 'allmant', data_type: 'integer' },
    { key: 'gallringsfrist_enhet', label: 'Gallringsfrist (enhet)', sort_order: 5, tab_key: 'allmant' },
    // Beskrivning
    { key: 'kortbeskrivning', label: 'Kort beskrivning', sort_order: 6, tab_key: 'beskrivning', data_type: 'longtext' },
    // Beskrivningsfält: Värde | Eget | Publicerad
    { key: 'sekretess',             label: 'Sekretess',             sort_order: 10, tab_key: 'beskrivning', has_own_published: true, is_public: false },
    { key: 'gallringsforeskrifter', label: 'Gallringsföreskrifter', sort_order: 11, tab_key: 'beskrivning', has_own_published: true },
    { key: 'bevaras',               label: 'Bevaras',               sort_order: 12, tab_key: 'beskrivning', has_own_published: true, data_type: 'boolean' },
    { key: 'diariefors',            label: 'Diarieförs',            sort_order: 13, tab_key: 'beskrivning', has_own_published: true, data_type: 'boolean' },
    { key: 'serie',                 label: 'Serie',                 sort_order: 14, tab_key: 'beskrivning', has_own_published: true },
    ...REFERENCES,
  ],
};

exports.seed = async function (knex) {
  for (const [code, defs] of Object.entries(BY_TYPE)) {
    const type = await knex('node_types').where({ code }).first();
    if (!type) {
      console.warn(`node type '${code}' not found – run 01_demo.js first`);
      continue;
    }
    for (const def of defs) await upsert(knex, type, def);
  }
};