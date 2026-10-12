/**
 * Reads one structure and everything the EAD3 export needs, in 6 queries
 * (not one query per node), and returns plain JS objects.
 *
 *   options.publicOnly = true  →  the same data the public site may show:
 *     - only nodes with is_published = 1
 *     - a node is dropped if any ancestor is unpublished (the whole branch is hidden)
 *     - only properties with is_public = 1 (OSL / GDPR)
 *
 * Returns: { structure, archive, roots: [node, …] }
 *   archive  the archive (arkiv) this structure belongs to, with its creator, or null
 *   node     { id, reference_code, title, ..., type, properties: [], relations: [], children: [] }
 */

async function loadStructure(knex, structureId, { publicOnly = false } = {}) {
  const structure = await knex('structures').where({ id: structureId }).first();
  if (!structure) return null;
  if (publicOnly && !structure.is_published) return null;

  const archive = await loadArchive(knex, structureId, publicOnly);

  const nodeRows = await knex('nodes as n')
    .join('node_types as nt', 'nt.id', 'n.node_type_id')
    .where('n.structure_id', structureId)
    .select(
      'n.id', 'n.parent_id', 'n.reference_code', 'n.previous_reference_code',
      'n.title', 'n.sort_order',
      'n.is_published', 'n.external_id', 'n.valid_from', 'n.valid_to',
      'n.description', 'n.portal_url',
      'nt.code as type_code', 'nt.name as type_name',
      'nt.ead_level', 'nt.ead_otherlevel',
    )
    .orderBy([{ column: 'n.parent_id' }, { column: 'n.sort_order' }, { column: 'n.id' }]);

  const nodeIds = nodeRows.map((n) => n.id);
  if (nodeIds.length === 0) return { structure, archive, roots: [] };

  // Property values (only the typed column that is set is used)
  const propQuery = knex('node_property_values as v')
    .join('property_definitions as d', 'd.id', 'v.property_definition_id')
    .join('nodes as n', 'n.id', 'v.node_id')
    .where('n.structure_id', structureId)
    .select(
      'v.node_id', 'd.key', 'd.label', 'd.data_type', 'd.ead_element', 'd.sort_order',
      'v.value_text', 'v.value_number', 'v.value_date', 'v.value_boolean',
    )
    .orderBy([{ column: 'v.node_id' }, { column: 'd.sort_order' }]);
  if (publicOnly) propQuery.where('d.is_public', true);
  const propRows = await propQuery;

  // Relations FROM nodes in this tree, with the target node (usually in another tree)
  const relQuery = knex('node_relations as r')
    .join('relation_types as rt', 'rt.id', 'r.relation_type_id')
    .join('nodes as src', 'src.id', 'r.from_node_id')
    .join('nodes as tgt', 'tgt.id', 'r.to_node_id')
    .join('structures as ts', 'ts.id', 'tgt.structure_id')
    .where('src.structure_id', structureId)
    .select(
      'r.from_node_id', 'rt.code as relation_code', 'rt.name as relation_name', 'rt.ead_element',
      'tgt.id as target_id', 'tgt.reference_code as target_reference_code',
      'tgt.title as target_title', 'tgt.is_published as target_is_published',
      'ts.name as target_structure_name', 'ts.is_published as target_structure_is_published',
    );
  const relRows = await relQuery;

  return { structure, archive, roots: buildTree(nodeRows, propRows, relRows, publicOnly) };
}

/**
 * The archive that uses this structure (archive_structures). If several archives use it,
 * the one whose link started most recently wins. Public mode skips unpublished archives
 * and leaves out an unpublished creator.
 */
async function loadArchive(knex, structureId, publicOnly) {
  const q = knex('archive_structures as l')
    .join('archives as a', 'a.id', 'l.archive_id')
    .join('archive_creators as c', 'c.id', 'a.archive_creator_id')
    .where('l.structure_id', structureId)
    .select(
      'a.id', 'a.reference_code', 'a.name', 'a.start_year', 'a.end_year', 'a.description',
      'a.external_id', 'a.is_published',
      'c.id as creator_id', 'c.name as creator_name', 'c.creator_type',
      'c.start_year as creator_start_year', 'c.end_year as creator_end_year',
      'c.description as creator_description', 'c.is_published as creator_is_published',
    )
    .orderBy([{ column: 'l.valid_from', order: 'desc' }, { column: 'a.id' }]);
  if (publicOnly) q.where('a.is_published', true);
  const row = await q.first();
  if (!row) return null;

  const showCreator = !publicOnly || Boolean(row.creator_is_published);
  return {
    id: row.id,
    reference_code: row.reference_code,
    name: row.name,
    start_year: row.start_year,
    end_year: row.end_year,
    description: row.description,
    external_id: row.external_id,
    creator: showCreator ? {
      id: row.creator_id,
      name: row.creator_name,
      type: row.creator_type,
      start_year: row.creator_start_year,
      end_year: row.creator_end_year,
      description: row.creator_description,
    } : null,
  };
}

/** Pure: rows → nested tree. Exported for tests. */
function buildTree(nodeRows, propRows, relRows, publicOnly = false) {
  const byId = new Map();
  for (const r of nodeRows) {
    byId.set(r.id, {
      id: r.id,
      parent_id: r.parent_id,
      reference_code: r.reference_code,
      previous_reference_code: r.previous_reference_code,
      title: r.title,
      sort_order: r.sort_order,
      is_published: Boolean(r.is_published),
      external_id: r.external_id,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      description: r.description,
      portal_url: r.portal_url,
      type: {
        code: r.type_code, name: r.type_name,
        ead_level: r.ead_level, ead_otherlevel: r.ead_otherlevel,
      },
      properties: [],
      relations: [],
      children: [],
    });
  }

  for (const p of propRows) {
    const node = byId.get(p.node_id);
    if (!node) continue;
    const value = pickValue(p);
    if (value === null || value === '') continue;
    node.properties.push({
      key: p.key, label: p.label, data_type: p.data_type,
      ead_element: p.ead_element, value,
    });
  }

  for (const r of relRows) {
    const node = byId.get(r.from_node_id);
    if (!node) continue;
    // Don't reveal a storage location the public may not see
    if (publicOnly && !(r.target_is_published && r.target_structure_is_published)) continue;
    node.relations.push({
      code: r.relation_code, name: r.relation_name, ead_element: r.ead_element,
      target: {
        id: r.target_id, reference_code: r.target_reference_code,
        title: r.target_title, structure_name: r.target_structure_name,
      },
    });
  }

  const roots = [];
  for (const node of byId.values()) {
    if (node.parent_id == null) roots.push(node);
    else byId.get(node.parent_id)?.children.push(node);
  }

  const order = (a, b) => a.sort_order - b.sort_order || a.id - b.id;
  const prune = (list) => list
    .filter((n) => !publicOnly || n.is_published)    // unpublished hides its whole branch
    .sort(order)
    .map((n) => ({ ...n, children: prune(n.children) }));
  return prune(roots);
}

function pickValue(p) {
  switch (p.data_type) {
    case 'number':  return p.value_number == null ? null : String(Number(p.value_number));
    case 'date':    return p.value_date == null ? null : toIsoDate(p.value_date);
    case 'boolean': return p.value_boolean == null ? null : (p.value_boolean ? 'Ja' : 'Nej');
    default:        return p.value_text;
  }
}

/** MSSQL returns DATE as a JS Date; SQLite (tests) as a string. Normalise to 'YYYY-MM-DD'. */
function toIsoDate(d) {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

module.exports = { loadStructure, buildTree, toIsoDate };
