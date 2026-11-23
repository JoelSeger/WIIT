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

    });

});
