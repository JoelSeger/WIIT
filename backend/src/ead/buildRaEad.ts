/**
 * Turns a loaded structure (see loadStructure.ts) into an RA-EAD XML string: Riksarkivet's
 * EAD 2002 variant, the format of the old arkivförteckningar (GV.ead, LS.ead).
 * Pure function like buildEad3.ts: no database, no I/O.
 *
 * It is the reverse of what eadMapper.ts / eadImport.ts read, so an imported arkivförteckning
 * can be written out again in the format it came in.
 *
 * Mapping WIIT - RA-EAD
 * 
 *  archives.external_id                   <eadheader><eadid>
 *  top node of level fonds (Arkiv)        <archdesc level="fonds">: its title, Historik as
 *                                         <custodhist>, Anmärkning as <odd>; Serie nodes in <dsc>
 *  archives.name (or structures.name)     the same, when the tree has no Arkiv node
 *  archive_creators.name / external_id    <origination><corpname role="arkivbildare" authfilenumber="…">
 *  archives.description                   <custodhist><p>
 *  nodes                                  nested <c level="…"> inside <dsc type="in-depth">
 *  node_types.ead_level / ead_otherlevel  @level / @otherlevel
 *  nodes.reference_code                   <did><unitid>
 *  nodes.title                            <did><unittitle label="…"> (left out when the node has
 *                                         no title of its own, i.e. title = reference_code)
 *  field 'did/unitdate' (Tid)             <did><unitdate>
 *  field 'did/physdesc' (Omfång)          <did><physdesc><extent unit="vol.">26</extent>
 *  field 'did/physloc' (Placering)        <did><physloc>
 *  field 'did/abstract' / 'did/unitid'    <did><abstract> / <did><unitid type="key">
 *  relation, ead_element 'physloc'        <did><physloc>target</physloc>
 *  nodes.description                      <scopecontent><p>
 *  field Anmärkning                       <odd><p>
 *  field with a block ead_element         <block><head>label</head><p>value</p></block>
 *  any other field                        <odd type="key"><head>label</head><p>value</p></odd>
 *  other relations                        <relatedmaterial><head>name</head><p>target</p>
 *
 * Not written, because WIIT does not store it: physloc/@type (always "Ja" in GV.ead / LS.ead,
 * meaning unknown), eadid/@mainagencycode, and the original <revisiondesc> date (the export
 * date is written instead).
 */

import { el, render, type Attrs, type XmlChild, type XmlElement } from './xml';
import { toIsoDate, type LoadedStructure, type NodeProperty, type NodeRelation, type TreeNode } from './loadStructure';
import { RA_EAD_NOTE_KEY } from './ead.types';

export const RA_EAD_NS = 'http://xml.ra.se/EAD';

// Block-level elements that EAD 2002 has: <x><head/>?<p/>+</x>
const BLOCKS = new Set([
  'scopecontent', 'appraisal', 'accessrestrict', 'userestrict', 'arrangement',
  'bioghist', 'custodhist', 'acqinfo', 'processinfo', 'accruals', 'altformavail',
  'originalsloc', 'otherfindaid', 'relatedmaterial', 'separatedmaterial',
  'phystech', 'prefercite', 'fileplan', 'odd',
]);

// Fields that are written inside <did>, or as an attribute, and therefore not as a block
const DID_FIELDS = new Set(['did/unitdate', 'did/physdesc', 'did/physloc', 'did/unitid', 'did/abstract']);
const TITLE_LABEL_KEY = 'titel_etikett';
const HISTORY_KEY = 'historik';

export interface BuildRaEadOptions {
  /** Date written to <revisiondesc>. Fixed in tests so output is stable. */
  generatedAt?: Date;
}

export function buildRaEad(loaded: LoadedStructure, { generatedAt = new Date() }: BuildRaEadOptions = {}): string {
  const { structure, archive, roots } = loaded;
  // An imported arkivförteckning starts with its Arkiv node (Arkiv / Serie / Volym): that node
  // is <archdesc>. Otherwise the archive row, or the structure, describes the fonds.
  const fondsRoot = roots.length === 1 && roots[0]!.type.ead_level === 'fonds' ? roots[0]! : null;
  const title = fondsRoot?.title ?? archive?.name ?? structure.name;
  const creator = archive?.creator ?? null;
  const description = fondsRoot ? null : (archive?.description ?? structure.description);
  const components = fondsRoot ? fondsRoot.children : roots;

  const header = el('eadheader', {}, [
    el('eadid', {}, archive?.external_id || structure.code),
    el('filedesc', {}, [el('titlestmt', {}, [el('titleproper', {}, title)])]),
    el('revisiondesc', {}, [
      el('change', {}, [
        el('date', {}, generatedAt.toISOString().slice(0, 10)),
        el('item', {}, 'Export från WIIT'),
      ]),
    ]),
  ]);

  const archdesc = el('archdesc', { level: 'fonds' }, [
    el('did', {}, [
      el('unitid', {}, (fondsRoot ? fondsRoot.reference_code : archive?.reference_code) || null),
      el('unittitle', {}, title),
      creator && el('origination', {}, [
        el('corpname', { authfilenumber: creator.external_id, role: 'arkivbildare' }, creator.name),
      ]),
    ]),
    description && block('custodhist', {}, null, description),
    ...(fondsRoot ? buildBlocks(fondsRoot) : []),
    el('dsc', { type: 'in-depth' }, components.map(buildC)),
  ]);

  const doc = el('ead', {
    xmlns: RA_EAD_NS,
    'xmlns:xlink': 'http://xml.ra.se/xlink',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation': `${RA_EAD_NS} ${RA_EAD_NS}/RA_EAD.xsd`,
  }, [header, archdesc]);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${render(doc)}\n`;
}


function buildC(node: TreeNode): XmlElement {
  const attrs: Attrs = node.type.ead_level === 'otherlevel'
    ? { level: 'otherlevel', otherlevel: node.type.ead_otherlevel || node.type.code }
    : { level: node.type.ead_level };
  return el('c', attrs, [buildDid(node), ...buildBlocks(node), ...node.children.map(buildC)]);
}

function buildDid(node: TreeNode): XmlElement {
  const values = (eadElement: string): string[] =>
    node.properties.filter((p) => p.ead_element === eadElement).map((p) => p.value);

  // A volume has no title in RA-EAD; the import then uses its number as the title
  const hasOwnTitle = node.title !== node.reference_code;
  const label = node.properties.find((p) => p.key === TITLE_LABEL_KEY)?.value ?? node.title;

  const dates = values('did/unitdate');
  const validity = [toIsoDate(node.valid_from), toIsoDate(node.valid_to)];

  const children: XmlChild[] = [
    el('unitid', {}, node.reference_code),
    hasOwnTitle && el('unittitle', { label }, node.title),
    ...dates.map((d) => el('unitdate', {}, d)),
    dates.length === 0 && (validity[0] || validity[1]) && el('unitdate', {}, `${validity[0] ?? ''} -- ${validity[1] ?? ''}`.trim()),
    ...values('did/abstract').map((v) => el('abstract', {}, v)),
    ...node.properties.filter((p) => p.ead_element === 'did/unitid').map((p) => el('unitid', { type: p.key }, p.value)),
    ...values('did/physdesc').map(physdesc),
    ...values('did/physloc').map((v) => el('physloc', {}, v)),
    ...node.relations.filter((r) => r.ead_element === 'physloc').map((r) => el('physloc', {}, describeTarget(r))),
  ];
  return el('did', {}, children);
}

/** "26 vol." was read from <extent unit="vol.">26</extent> and is written back the same way. */
function physdesc(value: string): XmlElement {
  const m = /^(\d+(?:[.,]\d+)?)\s+(\S.*)$/.exec(value.trim());
  return m ? el('physdesc', {}, [el('extent', { unit: m[2] }, m[1])]) : el('physdesc', {}, value);
}

function buildBlocks(node: TreeNode): XmlElement[] {
  const out: XmlElement[] = [];
  if (node.description) out.push(block('scopecontent', {}, null, node.description));

  for (const p of node.properties) {
    if (isInDid(p)) continue;
    if (p.key === RA_EAD_NOTE_KEY) out.push(block('odd', {}, null, p.value));
    else if (p.key === HISTORY_KEY) out.push(block('custodhist', {}, null, p.value));
    else if (p.ead_element && BLOCKS.has(p.ead_element)) out.push(block(p.ead_element, {}, p.label, p.value));
    else out.push(block('odd', { type: p.key }, p.label, p.value));   // unknown mapping, never dropped
  }

  for (const r of node.relations) {
    if (r.ead_element === 'physloc') continue;
    out.push(block('relatedmaterial', { type: r.code }, r.name, describeTarget(r)));
  }
  return out;
}

function isInDid(p: NodeProperty): boolean {
  return p.key === TITLE_LABEL_KEY || (p.ead_element !== null && DID_FIELDS.has(p.ead_element));
}

/** <tag><head>label</head><p>para</p>…</tag> – blank lines split paragraphs. */
function block(tag: string, attrs: Attrs, head: string | null, text: string): XmlElement {
  const paras = String(text).split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  return el(tag, attrs, [
    head && el('head', {}, head),
    ...(paras.length ? paras : ['']).map((p) => el('p', {}, p)),
  ]);
}

function describeTarget(r: NodeRelation): string {
  const t = r.target;
  const ref = t.reference_code ? `${t.reference_code} ` : '';
  return `${t.structure_name}: ${ref}${t.title}`;
}
