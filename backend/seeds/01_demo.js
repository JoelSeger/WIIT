/**
 * Demo data – two parallel trees linked to each other.
 *
 *   Struktur:  MAU (Arkiv) → Ekonomi (Serie) → F2 Fakturor (Serie) → Volym 1
 *   Förvaring: Arkivlokal A → Hylla 3 → Kartong 12
 *   Relation:  F2 Fakturor --förvaras i--> Kartong 12
 *
 * Node types and fields are placeholders to confirm with Arkivfunktionen
 * (ideally replaced by a real extract from Klara).
 */

exports.seed = async function (knex) {
  // Clear in dependency order (children before parents)
  await knex('transfer_jobs').del();
  await knex('structure_versions').del();
  await knex('change_log').del();
  await knex('ad_group_roles').del();
  await knex('node_relations').del();
  await knex('relation_types').del();
  await knex('node_property_values').del();
  await knex('property_definitions').del();
  // nodes: delete leaves first, because a parent with children is protected
  let remaining = await knex('nodes').count({ n: '*' }).first();
  while (remaining && Number(remaining.n) > 0) {
    await knex('nodes').whereNotIn('id', knex('nodes').whereNotNull('parent_id').select('parent_id')).del();
    remaining = await knex('nodes').count({ n: '*' }).first();
  }
  await knex('node_type_rules').del();
  await knex('node_types').del();
  await knex('structures').del();
  await knex('users').del();

  const insert = async (table, row) => {
    const [result] = await knex(table).insert(row, ['id']);
    return result.id;
  };

  // --- Demo user (normally created on first SSO login) ------------------------
  const admin = await insert('users', {
    ad_object_id: '00000000-0000-0000-0000-000000000001',
    username: 'demo.arkivarie',
    display_name: 'Demo Arkivarie',
  });

  // --- Structures -----------------------------------------------------------
  const klass = await insert('structures', {
    code: 'klass-2021', name: 'Klassificeringsstruktur 2021–', structure_type: 'struktur',
    valid_from: '2021-01-01', is_published: true, created_by: admin, updated_by: admin,
  });
  const forv = await insert('structures', {
    code: 'forvaring', name: 'Förvaring MAU', structure_type: 'forvaring',
    is_published: false, created_by: admin, updated_by: admin,
  });

  // --- Node types (Struktur → EAD3 levels) -----------------------------------
  const arkiv    = await insert('node_types', { code: 'arkiv',    name: 'Arkiv',    structure_type: 'struktur', ead_level: 'fonds' });
  const serie    = await insert('node_types', { code: 'serie',    name: 'Serie',    structure_type: 'struktur', ead_level: 'series' });
  const delserie = await insert('node_types', { code: 'delserie', name: 'Delserie', structure_type: 'struktur', ead_level: 'subseries' });
  const volym    = await insert('node_types', { code: 'volym',    name: 'Volym',    structure_type: 'struktur', ead_level: 'file' });
  const handling = await insert('node_types', { code: 'handling', name: 'Handling', structure_type: 'struktur', ead_level: 'item' });

  // --- Node types (Förvaring → otherlevel) -----------------------------------
  const lokal   = await insert('node_types', { code: 'arkivlokal', name: 'Arkivlokal', structure_type: 'forvaring', ead_level: 'otherlevel', ead_otherlevel: 'arkivlokal' });
  const hylla   = await insert('node_types', { code: 'hylla',      name: 'Hylla',      structure_type: 'forvaring', ead_level: 'otherlevel', ead_otherlevel: 'hylla' });
  const kartong = await insert('node_types', { code: 'kartong',    name: 'Kartong',    structure_type: 'forvaring', ead_level: 'otherlevel', ead_otherlevel: 'kartong' });

  await knex('node_type_rules').insert([
    { parent_type_id: arkiv,    child_type_id: serie },
    { parent_type_id: serie,    child_type_id: serie },
    { parent_type_id: serie,    child_type_id: delserie },
    { parent_type_id: serie,    child_type_id: volym },
    { parent_type_id: delserie, child_type_id: volym },
    { parent_type_id: volym,    child_type_id: handling },
    { parent_type_id: lokal,    child_type_id: hylla },
    { parent_type_id: hylla,    child_type_id: kartong },
  ]);

  // --- Property definitions ---------------------------------------------------
  const pTid    = await insert('property_definitions', { node_type_id: serie, key: 'tidsomfang',  label: 'Tidsomfång',  data_type: 'text',     ead_element: 'did/unitdate', sort_order: 1 });
  const pBeskr  = await insert('property_definitions', { node_type_id: serie, key: 'beskrivning', label: 'Beskrivning', data_type: 'longtext', ead_element: 'scopecontent', sort_order: 2 });
  const pGallr  = await insert('property_definitions', { node_type_id: serie, key: 'gallring',    label: 'Gallring',    data_type: 'text',     ead_element: 'appraisal',    sort_order: 3,
    help_text: 'Skriv regeln i klartext, t.ex. "Gallras efter 2 år". Gallring sker manuellt.' });
  const pSekr   = await insert('property_definitions', { node_type_id: serie, key: 'sekretess',   label: 'Sekretess (OSL)', data_type: 'text',  ead_element: 'accessrestrict', sort_order: 4, is_public: false });
  const pLank   = await insert('property_definitions', { node_type_id: serie, key: 'mau_arkiv',   label: 'Länk till MAU Arkiv', data_type: 'url', ead_element: 'dao', sort_order: 5 });
  await insert('property_definitions', { node_type_id: volym, key: 'tidsomfang', label: 'Tidsomfång', data_type: 'text', ead_element: 'did/unitdate', sort_order: 1 });

  // --- Struktur tree ----------------------------------------------------------
  const n = (row) => insert('nodes', { created_by: admin, updated_by: admin, ...row });
  const mau      = await n({ structure_id: klass, parent_id: null,    node_type_id: arkiv, reference_code: 'MAU', title: 'Malmö universitet', is_published: true });
  const ekonomi  = await n({ structure_id: klass, parent_id: mau,     node_type_id: serie, reference_code: 'F',   title: 'Ekonomi',           is_published: true, sort_order: 1 });
  const fakturor = await n({ structure_id: klass, parent_id: ekonomi, node_type_id: serie, reference_code: 'F2',  title: 'Fakturor',          is_published: true, sort_order: 1 });
  await n({ structure_id: klass, parent_id: fakturor, node_type_id: volym, reference_code: 'F2:1', title: 'Volym 1', is_published: true });

  await knex('node_property_values').insert([
    { node_id: fakturor, property_definition_id: pTid,   value_text: '2021–', updated_by: admin },
    { node_id: fakturor, property_definition_id: pBeskr, value_text: 'Leverantörsfakturor med underlag.', updated_by: admin },
    { node_id: fakturor, property_definition_id: pGallr, value_text: 'Gallras efter 10 år', updated_by: admin },
    { node_id: fakturor, property_definition_id: pSekr,  value_text: 'Kan innehålla uppgifter som omfattas av sekretess.', updated_by: admin },
    { node_id: fakturor, property_definition_id: pLank,  value_text: 'https://arkiv.internal.mau.se/', updated_by: admin },
  ]);

  // --- Förvaring tree ---------------------------------------------------------
  const lokalA = await n({ structure_id: forv, parent_id: null,   node_type_id: lokal,   reference_code: 'A',      title: 'Arkivlokal A' });
  const hylla3 = await n({ structure_id: forv, parent_id: lokalA, node_type_id: hylla,   reference_code: 'A-3',    title: 'Hylla 3' });
  const kart12 = await n({ structure_id: forv, parent_id: hylla3, node_type_id: kartong, reference_code: 'A-3-12', title: 'Kartong 12' });

  // --- Cross-tree relation ----------------------------------------------------
  const forvarasI = await insert('relation_types', { code: 'forvaras_i', name: 'förvaras i', inverse_name: 'innehåller', ead_element: 'physloc' });
  await knex('node_relations').insert({ relation_type_id: forvarasI, from_node_id: fakturor, to_node_id: kart12, created_by: admin });

  // --- Permissions (AD group names are placeholders) --------------------------
  await knex('ad_group_roles').insert([
    { ad_group: 'MAU-Arkivfunktionen', role: 'admin',  structure_id: null },
    { ad_group: 'MAU-Registratorer',   role: 'editor', structure_id: klass },
  ]);
};
