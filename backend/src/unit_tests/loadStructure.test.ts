/**
 Unit tests for the pure helpers in loadStructure (ead/loadStructure.ts): buildTree and toIsoDate.
 loadStructure itself runs the database queries and is not tested here. buildTree turns the
 query rows (nodes, property values, relations) into the nested tree the EAD exports use,
 so nothing is mocked: rows go in and the tree is checked. The rows are built with the
 make* helpers below.


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import { buildTree, toIsoDate } from '../ead/loadStructure';
import type { NodeQueryRow, PropertyQueryRow, RelationQueryRow } from '../ead/loadStructure';


// setup for the tests

const makeNodeRow = (overrides: Partial<NodeQueryRow> = {}): NodeQueryRow => ({
    id: 1,
    parent_id: null,
    reference_code: '1',
    previous_reference_code: null,
    title: 'Leda verksamhet',
    sort_order: 0,
    is_published: 1,
    external_id: null,
    valid_from: null,
    valid_to: null,
    description: null,
    portal_url: null,
    type_code: 'verksamhetsomrade',
    type_name: 'Verksamhetsområde',
    ead_level: 'otherlevel',
    ead_otherlevel: 'structuralunit',
    ead_unit_description: 'Verksamhetsområde',
    ...overrides,
});

const makePropRow = (overrides: Partial<PropertyQueryRow> = {}): PropertyQueryRow => ({
    node_id: 1,
    key: 'gallringsforeskrifter',
    label: 'Gallringsföreskrifter',
    data_type: 'text',
    ead_element: 'appraisal',
    sort_order: 0,
    value_text: 'RA-FS 2021:6',
    value_number: null,
    value_date: null,
    value_boolean: null,
    ...overrides,
});

const makeRelRow = (overrides: Partial<RelationQueryRow> = {}): RelationQueryRow => ({
    from_node_id: 1,
    relation_code: 'forvaras_i',
    relation_name: 'förvaras i',
    ead_element: 'physloc',
    target_id: 99,
    target_reference_code: '1',
    target_title: 'Arkivbox 1',
    target_is_published: 1,
    target_structure_name: 'Förvaringsenheter',
    target_structure_is_published: 1,
    ...overrides,
});


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('loadStructure', () => {

    describe('buildTree - nodes', () => {

        /*
         Verifies that a node row becomes a tree node: the columns are copied, is_published
         0/1 becomes a boolean, and the node_types columns are grouped under type.
         A missing ead_unit_description is written as null.
         */
        test('_TC274_buildTree_mapsNodeRow', () => {
            const roots = buildTree(
                [makeNodeRow({ external_id: 'UN123', valid_from: '2021-01-01', ead_unit_description: undefined as unknown as null })],
                [],
                [],
            );

            expect(roots).toHaveLength(1);
            expect(roots[0]).toEqual({
                id: 1,
                parent_id: null,
                reference_code: '1',
                previous_reference_code: null,
                title: 'Leda verksamhet',
                sort_order: 0,
                is_published: true,
                external_id: 'UN123',
                valid_from: '2021-01-01',
                valid_to: null,
                description: null,
                portal_url: null,
                type: {
                    code: 'verksamhetsomrade',
                    name: 'Verksamhetsområde',
                    ead_level: 'otherlevel',
                    ead_otherlevel: 'structuralunit',
                    ead_unit_description: null,
                },
                properties: [],
                relations: [],
                children: [],
            });
        });


        /*
         Verifies the nesting: a node is placed under its parent, nodes without parent are the
         roots, and a node whose parent is not in the rows is dropped.
         */
        test('_TC275_buildTree_nestsChildrenUnderParent', () => {
            const roots = buildTree([
                makeNodeRow({ id: 1 }),
                makeNodeRow({ id: 2, parent_id: 1, title: 'Hantera ärenden' }),
                makeNodeRow({ id: 3, parent_id: 2, title: 'Diarieföra' }),
                makeNodeRow({ id: 4, parent_id: 999, title: 'Föräldralös' }),
            ], [], []);

            expect(roots.map((n) => n.id)).toEqual([1]);
            expect(roots[0]!.children.map((n) => n.id)).toEqual([2]);
            expect(roots[0]!.children[0]!.children.map((n) => n.id)).toEqual([3]);
            expect(JSON.stringify(roots)).not.toContain('Föräldralös');
        });


        /*
         Verifies the order: roots and children are sorted by sort_order, and on the same
         sort_order by id.
         */
        test('_TC276_buildTree_sortsBySortOrderThenId', () => {
            const roots = buildTree([
                makeNodeRow({ id: 5, sort_order: 1 }),
                makeNodeRow({ id: 3, sort_order: 0 }),
                makeNodeRow({ id: 2, sort_order: 1 }),
                makeNodeRow({ id: 9, parent_id: 3, sort_order: 2 }),
                makeNodeRow({ id: 8, parent_id: 3, sort_order: 1 }),
            ], [], []);

            expect(roots.map((n) => n.id)).toEqual([3, 2, 5]);
            expect(roots[0]!.children.map((n) => n.id)).toEqual([8, 9]);
        });


        /*
         Verifies publicOnly for nodes: an unpublished node is left out together with its whole
         branch, even if the children are published. Without publicOnly every node is kept.
         */
        test('_TC277_buildTree_publicOnlyHidesUnpublishedBranch', () => {
            const rows = [
                makeNodeRow({ id: 1 }),
                makeNodeRow({ id: 2, sort_order: 1, is_published: 0 }),
                makeNodeRow({ id: 3, parent_id: 2, is_published: 1 }),
            ];

            const publicRoots = buildTree(rows, [], [], true);
            const allRoots = buildTree(rows, [], []);

            expect(publicRoots.map((n) => n.id)).toEqual([1]);
            expect(allRoots.map((n) => n.id)).toEqual([1, 2]);
            expect(allRoots[1]!.is_published).toBe(false);
            expect(allRoots[1]!.children.map((n) => n.id)).toEqual([3]);
        });

    });



    describe('buildTree - properties', () => {

        /*
         Verifies that property values are added to their node as strings: text as it is,
         a number (also a DECIMAL that comes back as a string) without trailing zeros,
         a date as YYYY-MM-DD, and a boolean as Ja / Nej.
         */
        test('_TC278_buildTree_formatsPropertyValues', () => {
            const roots = buildTree([makeNodeRow()], [
                makePropRow(),
                makePropRow({ key: 'antal', label: 'Antal', data_type: 'number', ead_element: null, value_text: null, value_number: '12.50' }),
                makePropRow({ key: 'hylla', label: 'Hylla', data_type: 'number', ead_element: null, value_text: null, value_number: 3 }),
                makePropRow({ key: 'beslutad', label: 'Beslutad', data_type: 'date', ead_element: null, value_text: null, value_date: new Date('2024-05-01T00:00:00.000Z') }),
                makePropRow({ key: 'giltig', label: 'Giltig', data_type: 'date', ead_element: null, value_text: null, value_date: '2023-02-03 00:00:00' }),
                makePropRow({ key: 'sekretess', label: 'Sekretess', data_type: 'boolean', ead_element: null, value_text: null, value_boolean: true }),
                makePropRow({ key: 'gdpr', label: 'GDPR', data_type: 'boolean', ead_element: null, value_text: null, value_boolean: 0 }),
            ], []);

            const values = Object.fromEntries(roots[0]!.properties.map((p) => [p.key, p.value]));

            expect(values).toEqual({
                gallringsforeskrifter: 'RA-FS 2021:6',
                antal: '12.5',
                hylla: '3',
                beslutad: '2024-05-01',
                giltig: '2023-02-03',
                sekretess: 'Ja',
                gdpr: 'Nej',
            });
            expect(roots[0]!.properties[0]).toEqual({
                key: 'gallringsforeskrifter',
                label: 'Gallringsföreskrifter',
                data_type: 'text',
                ead_element: 'appraisal',
                value: 'RA-FS 2021:6',
            });
        });


        /*
         Verifies that empty values are skipped: a null in the typed column for number, date,
         boolean and text, and an empty text. A value for a node that is not in the rows is
         ignored.
         */
        test('_TC279_buildTree_skipsEmptyPropertyValues', () => {
            const roots = buildTree([makeNodeRow()], [
                makePropRow({ data_type: 'number', value_text: '5', value_number: null }),
                makePropRow({ data_type: 'date', value_text: '2024-01-01', value_date: null }),
                makePropRow({ data_type: 'boolean', value_text: 'Ja', value_boolean: null }),
                makePropRow({ data_type: 'longtext', value_text: null }),
                makePropRow({ data_type: 'url', value_text: '' }),
                makePropRow({ node_id: 999 }),
            ], []);

            expect(roots[0]!.properties).toEqual([]);
        });

    });



    describe('buildTree - relations', () => {

        /*
         Verifies that a relation is added to the node it goes from, with the target node and
         its structure name. A relation from a node that is not in the rows is ignored.
         */
        test('_TC280_buildTree_addsRelations', () => {
            const roots = buildTree([makeNodeRow()], [], [
                makeRelRow(),
                makeRelRow({ from_node_id: 999 }),
            ]);

            expect(roots[0]!.relations).toEqual([{
                code: 'forvaras_i',
                name: 'förvaras i',
                ead_element: 'physloc',
                target: { id: 99, reference_code: '1', title: 'Arkivbox 1', structure_name: 'Förvaringsenheter' },
            }]);
        });


        /*
         Verifies publicOnly for relations: a relation is only kept when both the target node
         and the target's structure are published. Without publicOnly all relations are kept.
         */
        test('_TC281_buildTree_publicOnlyHidesUnpublishedTargets', () => {
            const rels = [
                makeRelRow({ target_id: 1 }),
                makeRelRow({ target_id: 2, target_is_published: 0 }),
                makeRelRow({ target_id: 3, target_structure_is_published: false }),
            ];

            const publicRoots = buildTree([makeNodeRow()], [], rels, true);
            const allRoots = buildTree([makeNodeRow()], [], rels);

            expect(publicRoots[0]!.relations.map((r) => r.target.id)).toEqual([1]);
            expect(allRoots[0]!.relations.map((r) => r.target.id)).toEqual([1, 2, 3]);
        });

    });



    describe('toIsoDate', () => {

        /*
         Verifies that a JS Date (MSSQL) and a string (SQLite) both become YYYY-MM-DD,
         and that null / undefined give null.
         */
        test('_TC282_toIsoDate_normalisesDates', () => {
            expect(toIsoDate(new Date('2025-12-31T00:00:00.000Z'))).toBe('2025-12-31');
            expect(toIsoDate('2021-01-01T12:30:00')).toBe('2021-01-01');
            expect(toIsoDate('2021-01-01')).toBe('2021-01-01');
            expect(toIsoDate(null)).toBeNull();
            expect(toIsoDate(undefined)).toBeNull();
        });

    });

});
