/**
 Unit tests for NodeTreeService (services/nodeTreeService.ts).
 This used to be nodeService.test.ts. NodeService was split up on develop and getTree
 now lives in NodeTreeService (same code), so the tests moved here and kept their ids.
 All four repositories are mocked with jest.fn(), so nothing here touches any db.
 Covers getTree from start to end: the early exits, how the flat node rows are
 turned into a nested tree, how field values get attached and sorted, and what
 the public site is allowed to see (publicOnly filtering of fields and the
 pruning of unpublished branches).

 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import type { Node } from '../models/node/node';
import type { NodePropertyValues } from '../models/node/nodePropertyValues';
import type { NodeType } from '../models/node/nodeType';
import type { PropertyDefinition } from '../models/property/propertyDefinition';
import type { Structure } from '../models/structure/structure';
import type { NodeRepository } from '../repos/nodeRepository';
import type { NodeTypeRepository } from '../repos/nodeTypeRepository';
import type { PropertyDefinitionRepository } from '../repos/propertyDefinitionRepository';
import type { StructureRepository } from '../repos/structureRepository';
import { NodeTreeService } from '../services/nodeTreeService';


// setup for the tests

const makeStructure =(overrides: Partial<Structure> = {}): Structure => ({
    id: 10,
    code: 'ARK-1',
    name: 'Arkiv',
    structureType: 'arkivforteckning',
    description: null,
    validFrom: null,
    validTo: null,
    isPublished:true,
    agencyCode: null,
    agencyName: null,
    languageCode: 'sv',
    license: null,
    version: null,
    previousStructureId: null,
    externalId: null,
    ...overrides,

});

const makeNode = (overrides: Partial<Node> = {}): Node => ({
    id: 1,
    structureId: 10,
    parentId: null,
    nodeTypeId: 100,
    referenceCode: null,
    previousReferenceCode:null,
    title: 'Node',
    sortOrder: 0,
    isPublished: true,
    externalId: null,
    validFrom: null,
    validTo:null,
    description: null,
    portalUrl: null,
    sourceUpdatedAt: null,
    sourceUpdatedBy: null,
    ...overrides,
});


const makeNodeType = (overrides: Partial<NodeType> = {}): NodeType => ({
    id: 100,
    code: 'series',
    name: 'Serie',
    structureType: 'arkivforteckning',
    eadLevel: 'series',
    eadOtherlevel: null,
    eadUnitDescription: null,
    description: null,
    isActive: true,
    canBeRoot: false,
    hasActivities: false,
    ...overrides,

});

const makeDefinition = (overrides: Partial<PropertyDefinition> = {}): PropertyDefinition => ({
    id: 500,
    nodeTypeId: 100,
    key: 'note',
    label: 'Anteckning',
    dataType: 'text',
    isRequired: false,
    isPublic: true,
    eadElement: null,
    helpText: null,
    sortOrder: 0,
    isActive: true,
    isRepeatable: false,
    tabKey: null,
    groupKey: null,
    hasOwnPublished: false,
    ...overrides,
});

const makeValue = (overrides: Partial<NodePropertyValues> = {}): NodePropertyValues => ({
    id: 900,
    nodeId: 1,
    propertyDefinitionId: 500,
    valueText: 'some text',
    valueOrder: 0,
    ...overrides,
});

// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('NodeTreeService', () => {
    let nodes: jest.Mocked<NodeRepository>;
    let nodeTypes: jest.Mocked<NodeTypeRepository>;
    let definitions: jest.Mocked<PropertyDefinitionRepository>;
    let structures: jest.Mocked<StructureRepository>;
    let service: NodeTreeService;

    beforeEach(() => {
        nodes = {
            findByStructure: jest.fn(),
            findValuesByStructure: jest.fn(),
        } as unknown as jest.Mocked<NodeRepository>;

        nodeTypes = { findByIds: jest.fn() } as unknown as jest.Mocked<NodeTypeRepository>;

        definitions = { findByIds: jest.fn() } as unknown as jest.Mocked<PropertyDefinitionRepository>;
        structures = { findById: jest.fn() } as unknown as jest.Mocked<StructureRepository>;

        nodes.findValuesByStructure.mockResolvedValue([]);
        definitions.findByIds.mockResolvedValue([]);

        service = new NodeTreeService(nodes, nodeTypes, definitions, structures);
    });



    describe('getTree - early exits',() => {

        /*
         Verifies that when asking for a structure id that doesn't exist it gives back null,
         and that we don't bother loading any nodes.
         */
        test('_TC027_getTree_returnsNullWhenStructureMissing', async () => {
            structures.findById.mockResolvedValue(undefined);

            const tree = await service.getTree(999);
            expect(tree).toBeNull();
            expect(nodes.findByStructure).not.toHaveBeenCalled();

        });


        /*
         Verifies that the public site can't show a structure that isn't published yet;
         getTree with publicOnly=true be returning null for it.
         */
        test('_TC028_getTree_returnsNullForUnpublishedStructureInPublicMode', async () => {
            structures.findById.mockResolvedValue(makeStructure({ isPublished: false }));

            const tree = await service.getTree(10, true);
            expect(tree).toBeNull();
            expect(nodes.findByStructure).not.toHaveBeenCalled();

        });


        /*
         Verifies that the same unpublished structure is still shown to logged-in users
         (publicOnly=false) . editors can work on it even if not public.
         */
        test('_TC029_getTree_returnsTreeForUnpublishedStructureWhenNotPublic', async () => {

            structures.findById.mockResolvedValue(makeStructure({ isPublished: false }));
            nodes.findByStructure.mockResolvedValue([makeNode()]);
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);

            const tree = await service.getTree(10, false);
            expect(tree).toHaveLength(1);
        });


        /*
         Verifies that a structure with no nodes gives an empty list(not null), and
         that the values query is skipped since there is nothing to attach.
         */
        test('_TC030_getTree_returnsEmptyListWhenStructureHasNoNodes', async () => {
            structures.findById.mockResolvedValue(makeStructure());
            nodes.findByStructure.mockResolvedValue([]);

            const tree = await service.getTree(10);
            expect(tree).toEqual([]);
            expect(nodes.findValuesByStructure).not.toHaveBeenCalled();
        });

    });



    describe('getTree - building the tree', () => {

        /*
         Verifies that flat rows are nested by parentId: two roots at the top, a child
         under the first root and a grandchild under that child.
         */
        test('_TC031_getTree_nestsChildrenUnderTheirParent', async () => {
            structures.findById.mockResolvedValue(makeStructure());
            nodes.findByStructure.mockResolvedValue([
                makeNode({id: 1, title: 'Root A' }),
                makeNode({ id: 2, parentId: 1, title: 'Child' }),
                makeNode({ id: 3,parentId: 2, title: 'Grandchild' }),
                makeNode({ id: 4, title: 'Root B' }),
            ]
            );
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);

            const tree =(await service.getTree(10))!;
            expect(tree.map((n) => n.title)).toEqual(['Root A', 'Root B']);
            expect(tree[0].children.map((n) => n.title)).toEqual(['Child']);
            expect(tree[0].children[0].children.map((n) => n.title)).toEqual(['Grandchild']);
            expect(tree[1].children).toEqual([]);

        });


        /*
         Verifies that siblings keep the same order the repository returned them in
         (the repo already sorts them by sortOrder, so the service shouldn't reshuffle them).
         */
        test('_TC032_getTree_keepsSiblingOrderFromRepository', async () => {
            structures.findById.mockResolvedValue(makeStructure());
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, title: 'Parent' }),
                makeNode({ id: 5, parentId: 1, title: 'First', sortOrder: 0 }),
                makeNode({id: 3, parentId: 1, title: 'Second', sortOrder: 1 }),
                makeNode({id: 4, parentId: 1, title: 'Third', sortOrder: 2 }),
            ]);
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);

            const tree = (await service.getTree(10))!;
            expect(tree[0].children.map((n) => n.title)).toEqual(['First', 'Second', 'Third']);
        });


        /*
         Verifies that every node gets the full node type object attached, and that the
         lookup of type is done once with each type id only once (no duplicates).
         */
        test('_TC033_getTree_attachesNodeTypeToEachNode', async () => {
            const series = makeNodeType({ id: 100, code: 'series' });
            const volume =makeNodeType({id: 200, code: 'volym', name: 'Volym' });

            structures.findById.mockResolvedValue(makeStructure());
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, nodeTypeId: 100 }),
                makeNode({ id: 2, parentId: 1, nodeTypeId: 200 }),
                makeNode({ id: 3, parentId: 1, nodeTypeId: 200}),
            ]);

            nodeTypes.findByIds.mockResolvedValue([series, volume]);

            const tree = (await service.getTree(10))!;

            expect(nodeTypes.findByIds).toHaveBeenCalledTimes(1);
            expect(nodeTypes.findByIds).toHaveBeenCalledWith([100, 200]);
            expect(tree[0].nodeType).toBe(series);
            expect(tree[0].children[0].nodeType).toBe(volume);
            expect(tree[0].children[1].nodeType).toBe(volume);



        });


        /*
         Verifies that rowVersion (the locking buffer from the SQL Server) is cut off
         before the tree is sent out, since the frontend has no use for that.
         */
        test('_TC034_getTree_leavesOutRowVersion', async () => {
            structures.findById.mockResolvedValue(makeStructure());
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, rowVersion: Buffer.from([0,0,0, 0, 0, 0, 0,1])}),
            ]);
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);

            const tree = (await service.getTree(10))!;
            expect(tree[0]).not.toHaveProperty('rowVersion');
            expect(tree[0].id).toBe(1);


        });


        /*
         Verifies that a node whose parent isn't in the result (e.g. parent row missing)
         isn't lost - it simply shows up as a root instead of disappearing.
         */
        test('_TC035_getTree_treatsNodeWithMissingParentAsRoot', async () => {
            structures.findById.mockResolvedValue(makeStructure());
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, title: 'Root' }),
                makeNode({ id: 2, parentId: 77, title: 'Orphan' }),
            ]);
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);

            const tree = (await service.getTree(10))!;
            expect(tree.map((n) => n.title)).toEqual(['Root', 'Orphan']);

        });

    });



    describe('getTree - field values', () => {

        beforeEach(() => {
            structures.findById.mockResolvedValue(makeStructure());
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);
        });


        /*
         Verifies that a value ends up on the right node with its field definition
         glued onto it, and that a node without values just gets an empty list.
         */
        test('_TC036_getTree_attachesValuesWithTheirDefinition', async () => {
            const note = makeDefinition({ id: 500, label: 'Anteckning' });
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1 }),
                makeNode({ id: 2, parentId: 1 }),
            ]);
            nodes.findValuesByStructure.mockResolvedValue([
                makeValue({ id: 900, nodeId: 1, propertyDefinitionId: 500, valueText: 'hej' }),

            ]);
            definitions.findByIds.mockResolvedValue([note]);

            const tree = (await service.getTree(10))!;

            expect(tree[0].values).toHaveLength(1);
            expect(tree[0].values[0].valueText).toBe('hej');
            expect(tree[0].values[0].definition).toBe(note);
            expect(tree[0].children[0].values).toEqual([]);
        });


        /*
         Verifies the order of values on one node: first by the field's sortOrder,
         and when it's the same field (repeatable) by valueOrder. The repo hands them
         over mixed up on purpose.
         */
        test('_TC037_getTree_sortsValuesByFieldThenValueOrder', async () => {
            nodes.findByStructure.mockResolvedValue([makeNode({ id: 1 })]);
            nodes.findValuesByStructure.mockResolvedValue([
                makeValue({ id: 1, propertyDefinitionId: 502, valueText: 'title', valueOrder: 0 }),
                makeValue({id: 2, propertyDefinitionId: 501, valueText: 'row 2', valueOrder: 1 }),
                makeValue({ id: 3, propertyDefinitionId: 501, valueText: 'row 1', valueOrder: 0 }),
            ]);
            definitions.findByIds.mockResolvedValue([
                makeDefinition({ id: 501, key: 'rows', sortOrder: 1, isRepeatable: true }),
                makeDefinition({ id: 502, key: 'heading', sortOrder: 5 }),
            ]);

            const tree = (await service.getTree(10))!;
            expect(tree[0].values.map((v) => v.valueText)).toEqual(['row 1', 'row 2', 'title']);
        });


        /*
         Verifies that a value pointing to a field definition we couldn't find
         (e.g. deleted or inactive field) is skipped instead of crashing the tree.
         */
        test('_TC038_getTree_skipsValuesWithUnknownDefinition', async () => {
            nodes.findByStructure.mockResolvedValue([makeNode({ id: 1 })]);
            nodes.findValuesByStructure.mockResolvedValue([
                makeValue({ id: 1, propertyDefinitionId: 500, valueText: 'kept' }),
                makeValue({ id: 2, propertyDefinitionId: 666, valueText: 'ghost' }),
            ]);

            definitions.findByIds.mockResolvedValue([makeDefinition({ id: 500 })]);

            const tree = (await service.getTree(10))!;
            expect(tree[0].values.map((v) => v.valueText)).toEqual(['kept']);

        });


        /*
         Verifies that the field definitions are fetched in one call and every
         definition id is asked for only once, even if lots of values share it.
         */
        test('_TC039_getTree_looksUpEachDefinitionOnlyOnce', async () => {
            nodes.findByStructure.mockResolvedValue([makeNode({ id: 1 }), makeNode({ id: 2 })]);
            nodes.findValuesByStructure.mockResolvedValue([
                makeValue({ id: 1, nodeId: 1, propertyDefinitionId: 500 }),
                makeValue({ id: 2, nodeId: 2, propertyDefinitionId: 500 }),
                makeValue({ id: 3, nodeId: 2, propertyDefinitionId: 501 }),
            ]);
            definitions.findByIds.mockResolvedValue([
                makeDefinition({ id: 500 }),
                makeDefinition({ id: 501 }),
            ]);

            await service.getTree(10);

            expect(definitions.findByIds).toHaveBeenCalledTimes(1);
            expect(definitions.findByIds).toHaveBeenCalledWith([500, 501]);
        });
    });



    describe('getTree - public mode', () => {

        beforeEach(() => {
            structures.findById.mockResolvedValue(makeStructure({ isPublished: true }));
            nodeTypes.findByIds.mockResolvedValue([makeNodeType()]);
        });


        /*
         Verifies that fields marked as not public (OSL / GDPR stuff) are left out
         when the public site asks, while the public ones are still there.
         */
        test('_TC040_getTree_hidesNonPublicFieldsInPublicMode', async () => {
            nodes.findByStructure.mockResolvedValue([makeNode({ id: 1 })]);
            nodes.findValuesByStructure.mockResolvedValue([
                makeValue({ id: 1, propertyDefinitionId: 500, valueText: 'open info' }),
                makeValue({ id: 2, propertyDefinitionId: 501, valueText: 'secret' }),
            ]);
            definitions.findByIds.mockResolvedValue([
                makeDefinition({ id: 500, isPublic: true }),
                makeDefinition({ id: 501, isPublic: false }),
            ]);

            const tree = (await service.getTree(10, true))!;
            expect(tree[0].values.map((v) =>
                v.valueText)).toEqual(['open info']);
        });


        /*
         Verifies the other side of TC040: logged-in users (not public mode)
         still get the non-public fields.
         */
        test('_TC041_getTree_keepsNonPublicFieldsWhenNotPublic', async () => {
            nodes.findByStructure.mockResolvedValue([makeNode({ id: 1 })]);
            nodes.findValuesByStructure.mockResolvedValue([
                makeValue({ id: 1, propertyDefinitionId: 501, valueText: 'secret' }),
            ]);
            definitions.findByIds.mockResolvedValue([makeDefinition({ id: 501, isPublic: false })]);

            const tree = (await service.getTree(10, false))!;

            expect(tree[0].values.map((v) =>
                v.valueText)).toEqual(['secret']);
        });


        /*
         Verifies that an unpublished node is removed in public mode together with
         everything under it - even a published child, since you'd only reach it
         through the hidden parent.
         */
        test('_TC042_getTree_dropsUnpublishedBranchInPublicMode', async () => {
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, title: 'Root' }),
                makeNode({ id: 2, parentId: 1, title: 'Visible child' }),
                makeNode({ id: 3, parentId: 1, title: 'Hidden child', isPublished: false }),
                makeNode({ id: 4, parentId: 3, title: 'Published but under hidden' }),
            ]);

            const tree = (await service.getTree(10, true))!;

            expect(tree.map((n) => n.title)).toEqual(['Root']);
            expect(tree[0].children.map((n) => n.title)).toEqual(['Visible child']);
        });


        /*
         Verifies that isPublished = null or 0 (what SQLite gives back instead of false)
         also counts as not published in public mode. Only true/1 gets through.
         */
        test('_TC043_getTree_treatsNullOrZeroAsUnpublished', async () => {
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, title: 'Null', isPublished: null }),
                makeNode({ id: 2, title: 'Zero', isPublished: 0 as unknown as boolean }),
                makeNode({ id: 3, title: 'One', isPublished: 1 as unknown as boolean }),
            ]);

            const tree = (await service.getTree(10, true))!;
            expect(tree.map((n) => n.title)).toEqual(['One']);
        });


        /*
         Verifies that without public mode nothing gets pruned, so editors still
         see unpublished nodes and their children.
         */
        test('_TC044_getTree_keepsUnpublishedNodesWhenNotPublic', async () => {
            nodes.findByStructure.mockResolvedValue([
                makeNode({ id: 1, title: 'Root', isPublished: false }),
                makeNode({ id: 2, parentId: 1, title: 'Child' }),
            ]);

            const tree = (await service.getTree(10, false))!;

            expect(tree.map((n) => n.title)).toEqual(['Root']);
            expect(tree[0].children.map((n) => n.title)).toEqual(['Child']);
        });
    });



});
