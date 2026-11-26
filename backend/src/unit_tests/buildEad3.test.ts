/**
 Unit tests for buildEad3 (ead/buildEad3.ts), the EAD3 export.
 buildEad3 is a pure function: a LoadedStructure goes in, an XML string comes out, so
 there is nothing to mock. The tests build a small structure with the make* helpers
 and check the XML with toContain / not.toContain.


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import { buildEad3, EAD3_NS } from '../ead/buildEad3';
import type {
    Archive,
    LoadedStructure,
    NodeProperty,
    NodeRelation,
    NodeType,
    StructureRow,
    TreeNode,
} from '../ead/loadStructure';


// setup for the tests

const GENERATED_AT = new Date('2026-11-21T10:00:00.000Z');

const makeStructure = (overrides: Partial<StructureRow> = {}): StructureRow => ({
    id: 10,
    code: 'ihp',
    name: 'Informationshanteringsplan',
    structure_type: 'klassificering',
    description: null,

    valid_from: null,
    valid_to: null,
    is_published: true,
    agency_code: 'SE-MAU',
    agency_name: 'Malmö universitet, Arkivfunktionen',

    language_code: 'swe',
    license: null,
    version: null,
    previous_structure_id: null,
    ...overrides,

});

const makeNode = (overrides: Partial<TreeNode> ={}): TreeNode => ({
    id: 1,
    parent_id: null,
    reference_code: '1',
    previous_reference_code: null,
    title: 'Leda verksamhet',
    sort_order:0,
    is_published:true,
    external_id: null,
    valid_from: null,
    valid_to: null,
    description: null,
    portal_url: null,
    type: {
        code: 'verksamhetsomrade',
        name: 'Verksamhetsområde',
        ead_level: 'otherlevel',
        ead_otherlevel: 'structuralunit',
        ead_unit_description: 'Verksamhetsområde',
    },
    properties: [],
    relations:[],
    children: [],
    ...overrides,


});


const makeProperty = (overrides: Partial<NodeProperty> = {}): NodeProperty =>({

    key: 'gallringsforeskrifter',
    label: 'Gallringsföreskrifter',
    data_type: 'text',
    ead_element: 'appraisal',
    value: 'RA-FS 2021:6',
    ...overrides,
});

const makeRelation = (overrides: Partial<NodeRelation> = {}): NodeRelation => ({
    code: 'forvaras_i',
    name: 'förvaras i',
    ead_element: 'physloc',
    target: { id: 99, reference_code: '1', title: 'Arkivbox 1', structure_name: 'Förvaringsenheter' },
    ...overrides,
});

// the top node of an imported arkivförteckning
const ARKIV_TYPE: NodeType = { code: 'arkiv', name: 'Arkiv', ead_level: 'fonds', ead_otherlevel: null, ead_unit_description: null };

const makeArchive = (overrides: Partial<Archive> = {}): Archive =>({
    id:5,
    reference_code: 'MAU-001',
    name: 'Malmö universitets arkiv',
    start_year: null,
    end_year: null,
    description: null,
    external_id: null,
    creator: {
        id: 3,
        name: 'Malmö universitet',
        external_id:null,
        type: 'corporate',
        start_year:null,
        end_year: null,
        description: 'Bildades 2018.',
    },
    ...overrides,
});


const makeLoaded =(overrides: Partial<LoadedStructure> = {}): LoadedStructure => ({

    structure: makeStructure(),
    archive: null,
    roots: [makeNode(),makeNode({id:2, reference_code: '2', title: 'Stödja verksamhet', sort_order:1})],
    ...overrides,
});


const build = (loaded: LoadedStructure, publicOnly = false)=>
    buildEad3(loaded, { generatedAt: GENERATED_AT, publicOnly });


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('buildEad3', () =>{

    describe('buildEad3 - header', () =>{

        /*
         Verifies the <control> part: the record id is agency code + structure code, the title
         is the structure name, version and license are written when set, and the export time
         is the generatedAt we pass in. A full export is marked audience="internal".
         */

        test('_TC078_buildEad3_writesControlHeader', ()=>{
            const xml = build(makeLoaded({ structure: makeStructure({ version: '2', license: 'CC0' }) }));

            expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
            expect(xml).toContain(`<ead xmlns="${EAD3_NS}" audience="internal">`);
            expect(xml).toContain('<recordid>SE-MAU-ihp</recordid>');

            expect(xml).toContain('<titleproper>Informationshanteringsplan</titleproper>');
            expect(xml).toContain('<edition>2</edition>');
            expect(xml).toContain('<abbr>CC0</abbr>');

            expect(xml).toContain('<agencycode>SE-MAU</agencycode>');
            expect(xml).toContain('<language langcode="swe">svenska</language>');
            expect(xml).toContain('2026-11-21T10:00:00.000Z');
            expect(xml).toContain('Fullständig export av strukturen');

        });


        /*
         Verifies the public export: audience="external", and the defaults when the structure
         has no agency: recordid starts with WIIT and the agency name is Malmö universitet.
         No version or license means no <editionstmt> and no <rightsdeclaration>.
         */
        test('_TC079_buildEad3_publicExportWithDefaults', () =>{

            const structure = makeStructure({ agency_code: null, agency_name: null });
            const xml = build(makeLoaded({ structure }), true);

            expect(xml).toContain('audience="external"');
            expect(xml).toContain('<recordid>WIIT-ihp</recordid>');
            expect(xml).toContain('<agencyname>Malmö universitet</agencyname>');

            expect(xml).not.toContain('<agencycode>');
            expect(xml).not.toContain('<editionstmt>');

            expect(xml).not.toContain('<rightsdeclaration>');
            expect(xml).toContain('Export av publicerad (offentlig) del av strukturen');

        });

    });



    describe('buildEad3 - archdesc', () => {

        /*
         Verifies that a structure with several top nodes and no archive becomes one
         <archdesc level="collection"> named after the structure, with every top node as a
         <c> inside <dsc>. A node without external_id gets the id wiit-node-<id>.
         */
        test('_TC080_buildEad3_severalRootsBecomeCollection', () =>{

            const xml = build(makeLoaded({ structure: makeStructure({ description: 'Planen för MAU.' }) }));

            expect(xml).toContain('<archdesc level="collection">');
            expect(xml).toContain('<unitid>ihp</unitid>');

            expect(xml).toContain('<unittitle>Informationshanteringsplan</unittitle>');
            expect(xml).toContain('<p>Planen för MAU.</p>');

            expect(xml).toContain('<c level="otherlevel" otherlevel="structuralunit" id="wiit-node-1">');
            expect(xml).toContain('<c level="otherlevel" otherlevel="structuralunit" id="wiit-node-2">');
            expect(xml).toContain('<unittitle>Stödja verksamhet</unittitle>');

        });


        /*
         Verifies that a structure linked to an archive uses the archive as the fonds: its
         reference code and name, the arkivbildare in <origination><corpname>, and the
         creator's description as <bioghist>. The top nodes go below it in <dsc>.
         */
        test('_TC081_buildEad3_archiveBecomesFonds', () =>{
            const xml = build(makeLoaded({ archive: makeArchive()}));

            expect(xml).toContain('<archdesc level="fonds">');
            expect(xml).toContain('<unitid>MAU-001</unitid>');

            expect(xml).toContain('<unittitle>Malmö universitets arkiv</unittitle>');
            expect(xml).toContain('<origination label="Arkivbildare">');

            expect(xml).toContain('<part>Malmö universitet</part>');
            expect(xml).toContain('<bioghist localtype="arkivbildare">');

            expect(xml).toContain('<p>Bildades 2018.</p>');
            expect(xml).toContain('<dsc>');
            expect(xml).not.toContain('level="collection"');

        });

    });



    describe('buildEad3 - nodes', () =>{

        /*
         Verifies the <did> of a node: reference code, previous reference code (with its own
         localtype), title, the structural unit description as <didnote>, and the validity
         dates as <unitdatestructured>. An NCName external_id is used as the @id.
         */
        test('_TC082_buildEad3_writesNodeDid', () =>{

            const node = makeNode({
                external_id: 'UN123',
                previous_reference_code: '1-old',
                valid_from: '2021-01-01',
                valid_to: new Date('2025-12-31T00:00:00.000Z'),

            });

            const xml = build(makeLoaded({ roots: [node, makeNode({id: 2 })]}));

            expect(xml).toContain('id="UN123"');
            expect(xml).toContain('<unitid>1</unitid>');

            expect(xml).toContain('<unitid localtype="tidigare_beteckning" label="Tidigare beteckning">1-old</unitid>');
            expect(xml).toContain('<didnote localtype="structuralunitdescription">Verksamhetsområde</didnote>');

            expect(xml).toContain('<fromdate standarddate="2021-01-01">2021-01-01</fromdate>');
            expect(xml).toContain('<todate standarddate="2025-12-31">2025-12-31</todate>');

        });


        /*
         Verifies where fields go: a field with a known block element (appraisal) becomes that
         block with the label as <head>; a field with no mapping becomes <odd> with the key as
         localtype, so nothing is lost; a 'did/unitdate' field goes inside <did> and then the
         validity dates are NOT written as well. Blank lines split the text into paragraphs.
         */
        test('_TC083_buildEad3_writesFieldsAsBlocksOrDid', () =>{

            const node = makeNode({
                valid_from: '2021-01-01',
                description: 'Första stycket.\n\nAndra stycket.',
                properties: [
                    makeProperty(),
                    makeProperty({ key: 'kortnamn', label: 'Kort namn', ead_element: null, value: 'LV' }),
                    makeProperty({ key: 'tid', label: 'Tid', ead_element: 'did/unitdate', value: '2021–' }),
                ],

            });

            const xml =build(makeLoaded({ roots: [node, makeNode({ id: 2})] }));

            expect(xml).toContain('<appraisal localtype="gallringsforeskrifter">');
            expect(xml).toContain('<head>Gallringsföreskrifter</head>');

            expect(xml).toContain('<p>RA-FS 2021:6</p>');
            expect(xml).toContain('<odd localtype="kortnamn">');

            expect(xml).toContain('<p>LV</p>');
            expect(xml).toContain('<unitdate label="Tid">2021–</unitdate>');

            expect(xml).not.toContain('<fromdate standarddate="2021-01-01">');
            expect(xml).toContain('<p>Första stycket.</p>');
            expect(xml).toContain('<p>Andra stycket.</p>');
        });


        /*
         Verifies relations: a 'physloc' relation is written inside <did> as <physloc> with the
         target described as "structure: code title"; a relation with a block element (odd)
         becomes that block, and one without any element becomes <relatedmaterial>. A target
         without reference code is described as just "structure: title".
         */
        test('_TC084_buildEad3_writesRelations', () => {
            const node = makeNode({
                relations: [
                    makeRelation(),
                    makeRelation({
                        code: 'redovisas_under', name: 'redovisas under', ead_element: 'odd',
                        target: { id: 7, reference_code: null, title: 'Ansökan', structure_name: 'IHP' },
                    }),
                    makeRelation({ code: 'relaterad_till', name: 'relaterad till', ead_element: null }),
                ],
            });

            const xml = build(makeLoaded({ roots: [node, makeNode({ id: 2 })] }));

            expect(xml).toContain('<physloc localtype="forvaras_i">Förvaringsenheter: 1 Arkivbox 1</physloc>');
            expect(xml).toContain('<odd localtype="redovisas_under">');
            expect(xml).toContain('<head>redovisas under</head>');
            expect(xml).toContain('<p>IHP: Ansökan</p>');
            expect(xml).toContain('<relatedmaterial localtype="relaterad_till">');
            expect(xml).toContain('<head>relaterad till</head>');
        });


        /*
         Verifies links and the special did fields: portal_url and a field with ead_element
         'dao' both become <dao> inside <did> (and the dao field is not written again as a block).
         A 'did/physloc' field keeps its key as localtype, and a 'did/<x>' that EAD3 does not
         allow inside <did> (did/foo) is left out of <did> and written as <odd> instead.
         */
        test('_TC085_buildEad3_writesLinksAndDidFields', () => {
            const node = makeNode({
                portal_url: 'https://arkiv.mau.se/1',
                properties: [
                    makeProperty({ key: 'lank', label: 'Länk', data_type: 'url', ead_element: 'dao', value: 'https://example.se/doc' }),
                    makeProperty({ key: 'placering', label: 'Placering', ead_element: 'did/physloc', value: 'Hylla 3' }),
                    makeProperty({ key: 'okand', label: 'Okänd', ead_element: 'did/foo', value: 'x' }),
                ],
            });

            const xml = build(makeLoaded({ roots: [node, makeNode({ id: 2 })] }));

            expect(xml).toContain('<dao daotype="unknown" href="https://arkiv.mau.se/1" linktitle="Visa i MAU Arkiv"/>');
            expect(xml).toContain('<dao daotype="unknown" href="https://example.se/doc" linktitle="Länk" localtype="lank"/>');
            expect(xml).not.toContain('<odd localtype="lank">');
            expect(xml).toContain('<physloc localtype="placering" label="Placering">Hylla 3</physloc>');
            expect(xml).not.toContain('<foo');
            expect(xml).toContain('<odd localtype="okand">');
        });


        /*
         Verifies the level attributes: a type with a standard EAD level is written as just
         level="…", and an otherlevel type without ead_otherlevel falls back to its own code.
         Children are nested inside their parent <c>.
         */
        test('_TC086_buildEad3_writesLevelAttributes', () => {
            const child = makeNode({
                id: 3, parent_id: 1, title: 'Hantera ärenden',
                type: { code: 'process', name: 'Process', ead_level: 'otherlevel', ead_otherlevel: null, ead_unit_description: null },
            });
            const root = makeNode({
                type: { code: 'serie', name: 'Serie', ead_level: 'series', ead_otherlevel: null, ead_unit_description: null },
                children: [child],
            });

            const xml = build(makeLoaded({ roots: [root, makeNode({ id: 2 })] }));

            expect(xml).toContain('<c level="series" id="wiit-node-1">');
            expect(xml).toContain('<c level="otherlevel" otherlevel="process" id="wiit-node-3">');
            expect(xml.indexOf('wiit-node-3')).toBeGreaterThan(xml.indexOf('wiit-node-1'));
        });


        /*
         Verifies that a field with an empty value still gives a block with one empty <p>,
         so the field is not lost on export. The empty text is written as <p></p>.
         */
        test('_TC087_buildEad3_writesEmptyFieldAsEmptyParagraph', () => {
            const node = makeNode({ properties: [makeProperty({ value: '' })] });

            const xml = build(makeLoaded({ roots: [node, makeNode({ id: 2 })] }));

            expect(xml).toContain('<appraisal localtype="gallringsforeskrifter">');
            expect(xml).toContain('<p></p>');
        });

    });



    describe('buildEad3 - other archdesc shapes', () => {

        /*
         Verifies an imported arkivförteckning: one top node of level fonds (Arkiv) becomes the
         <archdesc level="fonds"> itself, gets the arkivbildare of the linked archive as
         <origination>, and its children go in <dsc>. The Arkiv node is not written as a <c>.
         */
        test('_TC088_buildEad3_fondsRootBecomesArchdesc', () => {
            const serie = makeNode({
                id: 2, parent_id: 1, reference_code: 'A1', title: 'Protokoll',
                type: { code: 'serie', name: 'Serie', ead_level: 'series', ead_otherlevel: null, ead_unit_description: null },
            });
            const arkiv = makeNode({ title: 'Testförvaltningen', type: ARKIV_TYPE, children: [serie] });

            const xml = build(makeLoaded({ archive: makeArchive(), roots: [arkiv] }));

            expect(xml).toContain('<archdesc level="fonds">');
            expect(xml).toContain('<unittitle>Testförvaltningen</unittitle>');
            expect(xml).toContain('<part>Malmö universitet</part>');
            expect(xml).toContain('<dsc>');
            expect(xml).toContain('<c level="series" id="wiit-node-2">');
            expect(xml).not.toContain('<c level="fonds"');
            expect(xml).not.toContain('<unittitle>Malmö universitets arkiv</unittitle>');
        });


        /*
         Verifies the same Arkiv node without a linked archive and without children: no
         <origination> and no <dsc>.
         */
        test('_TC089_buildEad3_fondsRootWithoutArchiveOrChildren', () => {
            const arkiv = makeNode({ title: 'Testförvaltningen', type: ARKIV_TYPE });

            const xml = build(makeLoaded({ roots: [arkiv] }));

            expect(xml).toContain('<archdesc level="fonds">');
            expect(xml).not.toContain('<origination');
            expect(xml).not.toContain('<dsc>');
        });


        /*
         Verifies that a structure with exactly one top node (not an Arkiv) and no archive uses
         that node as the archdesc, with the node's own level. Its children go in <dsc>;
         without children there is no <dsc>.
         */
        test('_TC090_buildEad3_singleRootBecomesArchdesc', () => {
            const child = makeNode({ id: 2, parent_id: 1, title: 'Okategoriserade ärenden' });
            const withChild = build(makeLoaded({ roots: [makeNode({ children: [child] })] }));
            const alone = build(makeLoaded({ roots: [makeNode()] }));

            expect(withChild).toContain('<archdesc level="otherlevel" otherlevel="structuralunit">');
            expect(withChild).toContain('<unittitle>Leda verksamhet</unittitle>');
            expect(withChild).toContain('<dsc>');
            expect(withChild).toContain('id="wiit-node-2"');
            expect(alone).not.toContain('<dsc>');
            expect(alone).not.toContain('level="collection"');
        });


        /*
         Verifies an archive without creator: no <origination> and no <bioghist>, the archive's
         start and end year become a date range (whole years), and its description becomes
         <scopecontent>. An archive without reference code gets no <unitid> in its did.
         */
        test('_TC091_buildEad3_archiveWithoutCreator', () => {
            const archive = makeArchive({
                reference_code: null, creator: null, start_year: 1998, end_year: 2015, description: 'Högskolans arkiv.',
            });

            const xml = build(makeLoaded({ archive }));

            expect(xml).not.toContain('<origination');
            expect(xml).not.toContain('<bioghist');
            expect(xml).toContain('<fromdate standarddate="1998">1998</fromdate>');
            expect(xml).toContain('<todate standarddate="2015">2015</todate>');
            expect(xml).toContain('<p>Högskolans arkiv.</p>');
            expect(xml).not.toContain('<unitid>MAU-001</unitid>');
        });


        /*
         Verifies the arkivbildare tag per creator type: person becomes <persname>, family
         <famname>, and an unknown type falls back to <corpname>.
         */
        test('_TC092_buildEad3_writesCreatorTagPerType', () => {
            const withType = (type: string) => build(makeLoaded({
                archive: makeArchive({ creator: { ...makeArchive().creator!, type: type as 'person' } }),
            }));

            expect(withType('person')).toContain('<persname>');
            expect(withType('family')).toContain('<famname>');
            expect(withType('unknown')).toContain('<corpname>');
        });

    });



    describe('buildEad3 - options and defaults', () => {

        /*
         Verifies the defaults when no options are passed: a full export (audience internal),
         generator "WIIT" and the current time in <maintenanceevent>.
         */
        test('_TC093_buildEad3_usesDefaultOptions', () => {
            const before = Date.now();

            const xml = buildEad3(makeLoaded());

            expect(xml).toContain('audience="internal"');
            expect(xml).toContain('<agent>WIIT</agent>');
            const stamp = /<eventdatetime standarddatetime="([^"]+)"/.exec(xml)![1]!;
            expect(new Date(stamp).getTime()).toBeGreaterThanOrEqual(before);
        });


        /*
         Verifies the language: a structure without language_code is written as swe/svenska,
         and any other language code is written as it is.
         */
        test('_TC094_buildEad3_writesLanguage', () => {
            const none = build(makeLoaded({ structure: makeStructure({ language_code: null }) }));
            const eng = build(makeLoaded({ structure: makeStructure({ language_code: 'eng' }) }));

            expect(none).toContain('<language langcode="swe">svenska</language>');
            expect(eng).toContain('<language langcode="eng">eng</language>');
        });

    });

});
