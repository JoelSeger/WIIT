/**
 Unit tests for NodeService.
 All four repositories are mocked with jest.fn(), so nothing here touches any db.
 For now this covers the first part of getTree: the early exits and how the flat
 node rows are turned into a nested tree. Field values, publicOnly filtering of
 values and the pruning of unpublished branches still has to be covered!!

 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)
 */


import type { Node } from '../models/node/node';
import type { NodeType } from '../models/node/nodeType';
import type { Structure } from '../models/structure/structure';
import type { NodeRepository } from '../repos/nodeRepository';
import type { NodeTypeRepository } from '../repos/nodeTypeRepository';
import type { PropertyDefinitionRepository } from '../repos/propertyDefinitionRepository';
import type { StructureRepository } from '../repos/structureRepository';
import { NodeService } from '../services/nodeService';


// setup for the tests

const makeStructure =(overrides: Partial<Structure> = {}): Structure => ({
    id: 10,
    code: 'ARK-1',
    name: 'Arkiv',
    structureType: 'arkivforteckning',
    description: null,
    validFrom: null,
    validTo: null,
    isPublished: true,
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
    previousReferenceCode: null,
    title: 'Node',
    sortOrder: 0,
    isPublished: true,
    externalId: null,
    validFrom: null,
    validTo: null,
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
    ...overrides,

});

// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('NodeService', () => {
    let nodes: jest.Mocked<NodeRepository>;
    let nodeTypes: jest.Mocked<NodeTypeRepository>;
    let definitions: jest.Mocked<PropertyDefinitionRepository>;
    let structures: jest.Mocked<StructureRepository>;
    let service: NodeService;

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

        service = new NodeService(nodes, nodeTypes, definitions, structures);
    });



    describe('getTree - early exits', () => {

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

    });



});
