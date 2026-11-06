/**
 * Fields per node level, from "Sammanfattning av information som vi behöver för att skapa struktur".
 *
 * Idempotent: an existing field only gets tab / group / has_own_published updated, so labels
 * and help texts edited in the admin UI are kept. All fields are optional (is_required = false).
 * Name, Beteckning, Tidigare beteckning, Giltig från/till, Beskrivning and the node type are
 * columns on `nodes`, so they are NOT property definitions.
 *
 * Run after 01_demo.js:  npm run seed
 */

async function upsert(knex, nodeTypeId, def) {
  const placement = {
    tab_key: def.tab_key,
    group_key: def.group_key ?? null,
    has_own_published: def.has_own_published ?? false,
  };
  const existing = await knex('property_definitions')
    .where({ node_type_id: nodeTypeId, key: def.key }).first();
  if (existing) {
    await knex('property_definitions').where({ id: existing.id }).update(placement);
    return;
  }
  await knex('property_definitions').insert({
    node_type_id: nodeTypeId,
    key: def.key,
    label: def.label,
    data_type: def.data_type ?? 'text',
    is_required: false,
    is_public: def.is_public ?? true,
    is_repeatable: def.is_repeatable ?? false,
    ead_element: def.ead_element ?? null,
    help_text: def.help_text ?? null,
    sort_order: def.sort_order,
    is_active: true,
    ...placement,
  });
}

// Referenser – the same table on every level that has it
const REFERENCES = [
  { key: 'referens_titel',     label: 'Titel',     data_type: 'text',    sort_order: 91 },
  { key: 'referens_typ',       label: 'Typ',       data_type: 'text',    sort_order: 92 },
  { key: 'referens_publicera', label: 'Publicera', data_type: 'boolean', sort_order: 93 },
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

  // Fields of a handlingsslag node (shown on the Handlingsslag tab of its process).
  // TODO: the Beskrivningsfält table of a handlingsslag (Informationsägare …) – add the rest when known.
  handlingsslag: [
    { key: 'kortnamn',       label: 'Kortnamn, handlingsslag',     sort_order: 1, tab_key: 'allmant' },
    { key: 'publikt_namn',   label: 'Publika handlingsslagsnamn',  sort_order: 2, tab_key: 'allmant' },
    { key: 'gallringsfrist', label: 'Gallringsfrist (värde)',      sort_order: 3, tab_key: 'allmant', data_type: 'number' },
    // TODO: unit options of Gallringsfrist are unknown – a text field until they are listed
    { key: 'gallringsfrist_enhet', label: 'Gallringsfrist (enhet)', sort_order: 4, tab_key: 'allmant' },
    { key: 'informationsagare', label: 'Informationsägare',        sort_order: 5, tab_key: 'beskrivning' },
  ],

  handlingstyp: [
    // Allmänt
    { key: 'kortnamn',      label: 'Kortnamn',      sort_order: 1, tab_key: 'allmant' },
    { key: 'strukturenhet', label: 'Strukturenhet', sort_order: 2, tab_key: 'allmant' },
    { key: 'tidsperiod',    label: 'Tidsperiod',    sort_order: 3, tab_key: 'allmant' },
    { key: 'gallringsfrist', label: 'Gallringsfrist', sort_order: 4, tab_key: 'allmant' },
    // Beskrivning
    { key: 'kortbeskrivning', label: 'Kort beskrivning', sort_order: 5, tab_key: 'beskrivning', data_type: 'longtext' },
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
    for (const def of defs) await upsert(knex, type.id, def);
  }
};
