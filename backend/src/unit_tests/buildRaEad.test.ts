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
    NodeRelation,
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

const makeRelation = (overrides: Partial<NodeRelation> = {}): NodeRelation => ({
    code: 'forvaras_i',
    name: 'förvaras i',
    ead_element: 'physloc',
    target: { id: 99, reference_code: '1', title: 'Arkivbox 1', structure_name: 'Förvaringsenheter' },
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


        /*
         Verifies validity dates when only one side is set: only from gives "from --", only to
         gives "-- to". An otherlevel type without ead_otherlevel falls back to its own code.
         */
        test('_TC100_buildRaEad_writesOpenDateRanges', () => {
            const onlyFrom = makeNode({ id: 1, reference_code: 'A1', valid_from: '2001-01-01' });
            const onlyTo = makeNode({
                id: 2, reference_code: 'B1', title: 'Koncept', valid_to: '2010-12-31',
                type: { code: 'svit', name: 'Svit', ead_level: 'otherlevel', ead_otherlevel: null, ead_unit_description: null },
            });

            const xml = build({ structure: makeStructure(), archive: null, roots: [onlyFrom, onlyTo] });

            expect(xml).toContain('<unitdate>2001-01-01 --</unitdate>');
            expect(xml).toContain('<unitdate>-- 2010-12-31</unitdate>');
            expect(xml).toContain('<c level="otherlevel" otherlevel="svit">');
        });


        /*
         Verifies an archive without Arkiv node: the archive gives the title, its reference code
         the <unitid>, its description the <custodhist>, and every top node is a <c>.
         */
        test('_TC101_buildRaEad_usesArchiveWithoutArkivNode', () => {
            const archive = makeArchive({ reference_code: 'GV-1', description: 'Arkivet efter förvaltningen.' });

            const xml = build({ structure: makeStructure(), archive, roots: [makeNode()] });

            expect(xml).toContain('<titleproper>Testförvaltningens arkiv</titleproper>');
            expect(xml).toContain('<unitid>GV-1</unitid>');
            expect(xml).toContain('<p>Arkivet efter förvaltningen.</p>');
            expect(xml).toContain('<corpname authfilenumber="MAH-1" role="arkivbildare">');
            expect(xml).toContain('<c level="series">');
        });

    });



    describe('buildRaEad - fields and relations', () => {

        /*
         Verifies the other <did> fields: Sammanfattning as <abstract>, an extra identifier as
         <unitid type="key">, an Omfång that is not "number unit" stays plain text in
         <physdesc>, a 'physloc' relation becomes <physloc> with the target, and the
         titel_etikett field gives the label of <unittitle> instead of the title.
         */
        test('_TC102_buildRaEad_writesOtherDidFields', () => {
            const node = makeNode({
                properties: [
                    makeProperty({ key: 'abstract', label: 'Sammanfattning', ead_element: 'did/abstract', value: 'Kort om serien.' }),
                    makeProperty({ key: 'annan_beteckning', label: 'Annan beteckning', ead_element: 'did/unitid', value: 'X-12' }),
                    makeProperty({ key: 'omfang', label: 'Omfång', ead_element: 'did/physdesc', value: 'en hyllmeter' }),
                    makeProperty({ key: 'titel_etikett', label: 'Titel (etikett)', ead_element: null, value: 'Styrelsens protokoll 2001-2010.' }),
                ],
                relations: [makeRelation()],
            });

            const xml = build({ structure: makeStructure(), archive: null, roots: [node] });

            expect(xml).toContain('<abstract>Kort om serien.</abstract>');
            expect(xml).toContain('<unitid type="annan_beteckning">X-12</unitid>');
            expect(xml).toContain('<physdesc>en hyllmeter</physdesc>');
            expect(xml).not.toContain('<extent');
            expect(xml).toContain('<physloc>Förvaringsenheter: 1 Arkivbox 1</physloc>');
            expect(xml).toContain('<unittitle label="Styrelsens protokoll 2001-2010.">Styrelsens protokoll</unittitle>');
            expect(xml).not.toContain('<odd type="titel_etikett">');
        });


        /*
         Verifies the blocks of a node: its description becomes <scopecontent>, a field with a
         block element (appraisal) gets that tag with the label as <head>, a field without any
         mapping becomes <odd type="key"> so nothing is lost, an empty value still gives one
         empty <p></p>, and a relation that is not physloc becomes <relatedmaterial type="code">.
         A target without reference code is described as "structure: title".
         */
        test('_TC103_buildRaEad_writesBlocksAndRelations', () => {
            const node = makeNode({
                description: 'Protokoll från styrelsens möten.',
                properties: [
                    makeProperty({ key: 'gallringsforeskrifter', label: 'Gallringsföreskrifter', ead_element: 'appraisal', value: 'Bevaras' }),
                    makeProperty({ key: 'kortnamn', label: 'Kortnamn', ead_element: null, value: 'SP' }),
                    makeProperty({ key: 'ovrigt', label: 'Övrigt', ead_element: null, value: '' }),
                ],
                relations: [makeRelation({
                    code: 'redovisas_under', name: 'redovisas under', ead_element: 'odd',
                    target: { id: 7, reference_code: null, title: 'Ansökan', structure_name: 'IHP' },
                })],
            });

            const xml = build({ structure: makeStructure(), archive: null, roots: [node] });

            expect(xml).toContain('<p>Protokoll från styrelsens möten.</p>');
            expect(xml).toContain('<appraisal>');
            expect(xml).toContain('<head>Gallringsföreskrifter</head>');
            expect(xml).toContain('<odd type="kortnamn">');
            expect(xml).toContain('<p>SP</p>');
            expect(xml).toContain('<odd type="ovrigt">');
            expect(xml).toContain('<p></p>');
            expect(xml).toContain('<relatedmaterial type="redovisas_under">');
            expect(xml).toContain('<p>IHP: Ansökan</p>');
        });

    });



    describe('buildRaEad - options', () => {

        /*
         Verifies that without options today's date is written in <revisiondesc>.
         */
        test('_TC104_buildRaEad_usesTodayByDefault', () => {
            const today = new Date().toISOString().slice(0, 10);

            const xml = buildRaEad(makeImported());

            expect(xml).toContain(`<date>${today}</date>`);
        });

    });

});
