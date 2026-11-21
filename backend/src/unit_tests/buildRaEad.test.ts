/**
 Unit tests for buildRaEad (ead/buildRaEad.ts), the RA-EAD export (Riksarkivet's EAD 2002
 variant, the format of the old arkivförteckningar GV.ead / LS.ead).
 buildRaEad is a pure function, so nothing is mocked: a LoadedStructure goes in and the
 XML string is checked with toContain / not.toContain. generatedAt is fixed.
 Covers an imported arkivförteckning (Arkiv > Serie > Volym): the header, the Arkiv node as
 <archdesc>, Historik and Anmärkning, volumes without their own title, Omfång as <extent>,
 and a structure without an Arkiv node or archive (falls back to the structure).


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import { buildRaEad, RA_EAD_NS } from '../ead/buildRaEad';
import type {
    Archive,
    LoadedStructure,
    NodeProperty,
    NodeType,
    StructureRow,
    TreeNode,
} from '../ead/loadStructure';


// setup for the tests

const GENERATED_AT = new Date('2026-11-21T10:00:00.000Z');
const ARKIV: NodeType = { code: 'arkiv', name: 'Arkiv', ead_level: 'fonds', ead_otherlevel: null, ead_unit_description: null};
const SERIE: NodeType = { code: 'serie', name: 'Serie', ead_level: 'series', ead_otherlevel: null, ead_unit_description: null };
const VOLYM: NodeType = { code: 'volym', name:'Volym', ead_level: 'otherlevel', ead_otherlevel: 'volym', ead_unit_description: null };

const makeStructure = (overrides: Partial<StructureRow> = {}): StructureRow =>({
    id: 20,
    code: 'GV',
    name: 'Arkivförteckning GV',
    structure_type: 'arkivforteckning',
    description: null,

    valid_from: null,
    valid_to: null,
    is_published: false,

    agency_code: null,
    agency_name: null,
    language_code: 'swe',

    license: null,
    version: null,
    previous_structure_id: null,
    ...overrides,

});

const makeNode = (overrides: Partial<TreeNode> = {}): TreeNode =>({
    id: 1,
    parent_id:null,
    reference_code: 'A1',
    previous_reference_code: null,

    title: 'Styrelsens protokoll',
    sort_order:0,
    is_published: false,
    external_id: null,

    valid_from: null,
    valid_to: null,
    description: null,
    portal_url: null,

    type:SERIE,
    properties: [],
    relations:[],
    children: [],
    ...overrides,

});

const makeProperty = (overrides: Partial<NodeProperty> = {}): NodeProperty =>
    ({

    key: 'tid',
    label: 'Tid',
    data_type: 'text',
    ead_element: 'did/unitdate',
    value: '2001 -- 2010',
    ...overrides,
});

const makeArchive =(overrides: Partial<Archive> = {}): Archive =>({
    id: 5,
    reference_code: null,
    name: 'Testförvaltningens arkiv',
    start_year: null,
    end_year: null,
    description: null,
    external_id:'SE/GV/001',

    creator: {
        id: 3,
        name:'Malmö högskola 1998-2015',
        external_id: 'MAH-1',
        type: 'corporate',
        start_year: 1998,
        end_year: 2015,
        description: null,
    },
    ...overrides,
});


// For an imported arkivförteckning: Arkiv > Serie A1 > Volym !!

const makeImported = (): LoadedStructure =>{
    const volym = makeNode({
        id: 3, parent_id: 2, reference_code: '1', title: '1', type:VOLYM,
        properties: [makeProperty({ value: '2001' }), makeProperty({ key: 'placering', label: 'Placering', ead_element: 'did/physloc', value: 'Källaren' })],
    });

    const serie = makeNode({
        id: 2, parent_id: 1,
        properties: [makeProperty(), makeProperty({ key: 'omfang', label: 'Omfång', ead_element: 'did/physdesc', value: '3 vol.' })],
        children: [volym],
    });

    const arkiv = makeNode({
        id:1, reference_code: null, title: 'Testförvaltningen 2001 - 2010', type:ARKIV,
        properties:[
            makeProperty({ key: 'historik', label: 'Historik', ead_element: 'custodhist', value: 'Förvaltningen lades ned 2010.' }),
            makeProperty({ key: 'anmarkning', label: 'Anmärkning', ead_element: null, value: 'Delvis gallrat.' }),
        ],
        children: [serie],
    });
    return { structure: makeStructure(), archive: makeArchive(), roots: [arkiv]};
};

const build = (loaded: LoadedStructure)=>
    buildRaEad(loaded, { generatedAt: GENERATED_AT });



// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('buildRaEad', () =>{

    describe('buildRaEad - imported arkivförteckning', () =>{

        /*
         Verifies the header: the RA-EAD namespace, eadid from the archive's external_id, the
         Arkiv node's title as titleproper, and the export date (only the day) in <revisiondesc>.
         */
        test('_TC096_buildRaEad_writesHeader', () =>{
            const xml =build(makeImported());

            expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
            expect(xml).toContain(`<ead xmlns="${RA_EAD_NS}"`);

            expect(xml).toContain('<eadid>SE/GV/001</eadid>');
            expect(xml).toContain('<titleproper>Testförvaltningen 2001 - 2010</titleproper>');

            expect(xml).toContain('<date>2026-11-21</date>');
            expect(xml).toContain('<item>Export från WIIT</item>');

        });



        /*
         Verifies that the single Arkiv node (level fonds) becomes <archdesc level="fonds">:
         its title, the arkivbildare as <corpname role="arkivbildare"> with the authority id,
         Historik as <custodhist> and Anmärkning as <odd> (no head). Its children, the series,
         go in <dsc type="in-depth">, and the Arkiv itself is not written as a <c>.
         */
        test('_TC097_buildRaEad_arkivNodeBecomesArchdesc', () =>{
            const xml = build(makeImported());

            expect(xml).toContain('<archdesc level="fonds">');
            expect(xml).toContain('<unittitle>Testförvaltningen 2001 - 2010</unittitle>');

            expect(xml).toContain('<corpname authfilenumber="MAH-1" role="arkivbildare">Malmö högskola 1998-2015</corpname>');
            expect(xml).toContain('<custodhist>');

            expect(xml).toContain('<p>Förvaltningen lades ned 2010.</p>');
            expect(xml).toContain('<odd>');

            expect(xml).toContain('<p>Delvis gallrat.</p>');
            expect(xml).toContain('<dsc type="in-depth">');

            expect(xml).toContain('<c level="series">');
            expect(xml).not.toContain('<c level="fonds">');

        });



        /*
         Verifies a series and its volume: the series keeps its title (with the title as
         label), Tid becomes <unitdate>, Omfång "3 vol." is split into <extent unit="vol.">3,
         and Placering becomes <physloc>. A volume whose title is just its number gets no
         <unittitle>, and is written as otherlevel="volym".
         */
        test('_TC098_buildRaEad_writesSeriesAndVolumes', () =>{
            const xml =build(makeImported());

            expect(xml).toContain('<unitid>A1</unitid>');
            expect(xml).toContain('<unittitle label="Styrelsens protokoll">Styrelsens protokoll</unittitle>');

            expect(xml).toContain('<unitdate>2001 -- 2010</unitdate>');
            expect(xml).toContain('<extent unit="vol.">3</extent>');

            expect(xml).toContain('<c level="otherlevel" otherlevel="volym">');
            expect(xml).toContain('<unitid>1</unitid>');

            expect(xml).not.toContain('<unittitle label="1">');
            expect(xml).toContain('<unitdate>2001</unitdate>');
            expect(xml).toContain('<physloc>Källaren</physloc>');

        });


    });



    describe('buildRaEad - without Arkiv node', () => {

        /*
         Verifies the fallback when there is no Arkiv node and no archive: eadid and title come
         from the structure, its description becomes <custodhist>, every top node is a <c> in
         <dsc>, and a node with validity dates but no Tid field gets "from -- to" as <unitdate>.
         */
        test('_TC099_buildRaEad_fallsBackToStructure', () =>{

            const node = makeNode({ valid_from: '2001-01-01', valid_to: '2010-12-31'});
            const loaded: LoadedStructure = {
                structure: makeStructure({ description: 'Förteckning över GV.'}),
                archive: null,
                roots: [node],
            };

            const xml =build(loaded);

            expect(xml).toContain('<eadid>GV</eadid>');
            expect(xml).toContain('<titleproper>Arkivförteckning GV</titleproper>');

            expect(xml).toContain('<p>Förteckning över GV.</p>');
            expect(xml).not.toContain('<origination>');

            expect(xml).toContain('<c level="series">');
            expect(xml).toContain('<unitdate>2001-01-01 -- 2010-12-31</unitdate>');
        });

    });



});
