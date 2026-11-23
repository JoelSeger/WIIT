/**
 Unit tests for NodeCreationService (services/nodeCreationService.ts).
 The repositories and the NodePropertyService are handed to the constructor, so there is no
 jest.mock here: the tests pass plain objects full of jest.fn(). knex.transaction is faked, it
 just runs the callback right away with a dummy trx. Nothing here touches any db.
 Covers createNode from start to end: missing structure, unknown node type, node type of the
 wrong structure type, root rules (allowed and not allowed), parent checks (missing, other
 structure, child type not allowed), the duplicate reference code check and the save of the
 property values in the same transaction.


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import type { Knex } from 'knex';
import type { Node } from '../models/node/node';
import type { NodeType } from '../models/node/nodeType';
import type { Structure } from '../models/structure/structure';
import { ConflictError, NotFoundError, ValidationError } from '../services/errorService';
import {
    NodeCreationService,
    type CreateNodeRequest,
    type NodeCreationProperties,
    type NodeCreationRepos,
} from '../services/nodeCreationService';


// setup for the tests

const makeStructure = (overrides: Partial<Structure> = {}): Structure => ({
    id: 10,
    code: 'KLA-1',
    name: 'Klassificering',
    structureType: 'klassificering',
    description: null,
    validFrom: null,
    validTo: null,
    isPublished: false,
    agencyCode: null,
    agencyName: null,
    languageCode: 'swe',
    license: null,
    version: null,
    previousStructureId: null,
    externalId: null,
    ...overrides,
});

const makeNodeType = (overrides: Partial<NodeType> = {}): NodeType => ({
    id: 200,
    code: 'processgrupp',
    name: 'Processgrupp',
    structureType: 'klassificering',
    eadLevel: 'otherlevel',
    eadOtherlevel: 'processgrupp',
    eadUnitDescription: null,
    description: null,
    isActive: true,
    ...overrides,
});

const makeNode = (overrides: Partial<Node> = {}): Node => ({
    id: 1,
    structureId: 10,
    parentId: null,
    nodeTypeId: 200,
    referenceCode: null,
    previousReferenceCode: null,
    title: 'Nod',
    sortOrder: 0,
    isPublished: false,
    externalId: null,
    validFrom: null,
    validTo: null,
    description: null,
    portalUrl: null,
    sourceUpdatedAt: null,
    sourceUpdatedBy: null,
    ...overrides,
});

const makeRequest = (overrides: Partial<CreateNodeRequest> = {}): CreateNodeRequest => ({
    structureId: 10,
    parentId: 5,
    nodeTypeCode: 'processgrupp',
    referenceCode: null,
    previousReferenceCode: null,
    title: 'Ny nod',
    sortOrder: 1,
    description: null,
    validFrom: null,
    validTo: null,
    properties: [],
    createdBy: 7,
    ...overrides,
});


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('NodeCreationService', () => {
    let structures: { findById: jest.Mock };
    let nodeTypes: { findByCode: jest.Mock; isAllowedChild: jest.Mock };
    let nodes: { findById: jest.Mock; existsByStructureParentAndReferenceCode: jest.Mock; createNode: jest.Mock };
    let properties: { saveValuesInTransaction: jest.Mock };
    let trx: Knex.Transaction;
    let knex: Knex;
    let service: NodeCreationService;

    beforeEach(() => {
        structures = { findById: jest.fn() };
        nodeTypes = { findByCode: jest.fn(), isAllowedChild: jest.fn() };
        nodes = { findById: jest.fn(), existsByStructureParentAndReferenceCode: jest.fn(), createNode: jest.fn() };
        properties = { saveValuesInTransaction: jest.fn() };

        structures.findById.mockResolvedValue(makeStructure());
        nodeTypes.findByCode.mockResolvedValue(makeNodeType());
        nodeTypes.isAllowedChild.mockResolvedValue(true);
        nodes.findById.mockResolvedValue(makeNode({ id: 5, nodeTypeId: 100 }));
        nodes.existsByStructureParentAndReferenceCode.mockResolvedValue(false);
        nodes.createNode.mockResolvedValue(makeNode({ id: 99 }));
        properties.saveValuesInTransaction.mockResolvedValue(undefined);

        trx = { isTrx: true } as unknown as Knex.Transaction;
        knex = {
            transaction: jest.fn(async (cb: (t: Knex.Transaction) => Promise<unknown>) => cb(trx)),
        } as unknown as Knex;

        // the repos are functions that give back the fake, like createRepositories() does
        const repos = {
            structures: () => structures,
            nodeTypes: () => nodeTypes,
            nodes: () => nodes,
        } as unknown as NodeCreationRepos;

        service = new NodeCreationService(knex, repos, properties as unknown as NodeCreationProperties);
    });


    describe('createNode - structure and node type', () => {

        /*
         Verifies that a structure id that does not exist gives a NotFoundError and that the
         service stops before it looks at the node type.
         */
        test('_TC200_createNode_rejectsMissingStructure', async () => {
            structures.findById.mockResolvedValue(undefined);

            await expect(service.createNode(makeRequest())).rejects.toThrow(NotFoundError);
            expect(nodeTypes.findByCode).not.toHaveBeenCalled();
            expect(nodes.createNode).not.toHaveBeenCalled();
        });


        /*
         Verifies that a node type code that does not exist (or is inactive) gives a
         ValidationError and nothing is created.
         */
        test('_TC201_createNode_rejectsUnknownNodeType', async () => {
            nodeTypes.findByCode.mockResolvedValue(undefined);

            await expect(service.createNode(makeRequest())).rejects.toThrow(ValidationError);
            await expect(service.createNode(makeRequest())).rejects.toThrow("Node type 'processgrupp' does not exist or is inactive");
            expect(nodes.createNode).not.toHaveBeenCalled();
        });


        /*
         Verifies that a node type that belongs to another kind of tree than the structure
         (here a forvaring type in a klassificering structure) is refused.
         */
        test('_TC202_createNode_rejectsNodeTypeOfOtherStructureType', async () => {
            nodeTypes.findByCode.mockResolvedValue(makeNodeType({ code: 'strukturenhet', structureType: 'forvaring' }));

            await expect(service.createNode(makeRequest({ nodeTypeCode: 'strukturenhet' }))).rejects.toThrow(ValidationError);
            await expect(service.createNode(makeRequest({ nodeTypeCode: 'strukturenhet' }))).rejects.toThrow(
                'belongs to forvaring structures, but structure 10 is klassificering',
            );
            expect(nodes.createNode).not.toHaveBeenCalled();
        });
    });


    describe('createNode - root and parent rules', () => {

        /*
         Verifies that a node without parent is only allowed when its type may be a root in
         this kind of structure. A processgrupp cannot be a root of a klassificering structure.
         */
        test('_TC203_createNode_rejectsRootOfTypeThatCannotBeRoot', async () => {
            const request = makeRequest({ parentId: null });

            await expect(service.createNode(request)).rejects.toThrow(ValidationError);
            await expect(service.createNode(request)).rejects.toThrow('is not allowed as a root node in a klassificering structure');
            expect(nodes.createNode).not.toHaveBeenCalled();
        });


        /*
         Verifies that a verksamhetsomrade is accepted as a root of a klassificering structure:
         no parent lookup is done and the node is created with parentId null.
         */
        test('_TC204_createNode_acceptsVerksamhetsomradeAsRoot', async () => {
            nodeTypes.findByCode.mockResolvedValue(makeNodeType({ id: 100, code: 'verksamhetsomrade' }));

            await service.createNode(makeRequest({ parentId: null, nodeTypeCode: 'verksamhetsomrade' }));

            expect(nodes.findById).not.toHaveBeenCalled();
            expect(nodes.createNode).toHaveBeenCalledWith(expect.objectContaining({ parentId: null, nodeTypeId: 100 }));
        });


        /*
         Verifies that a parent id that does not exist gives a NotFoundError.
         */
        test('_TC205_createNode_rejectsMissingParent', async () => {
            nodes.findById.mockResolvedValue(undefined);

            await expect(service.createNode(makeRequest())).rejects.toThrow(NotFoundError);
            await expect(service.createNode(makeRequest())).rejects.toThrow('Parent node 5 was not found');
            expect(nodes.createNode).not.toHaveBeenCalled();
        });


        /*
         Verifies that a parent from another structure is refused.
         */
        test('_TC206_createNode_rejectsParentFromOtherStructure', async () => {
            nodes.findById.mockResolvedValue(makeNode({ id: 5, structureId: 11 }));

            await expect(service.createNode(makeRequest())).rejects.toThrow('Parent node must belong to the same structure');
            expect(nodes.createNode).not.toHaveBeenCalled();
        });


        /*
         Verifies that the child type must be allowed under the type of the parent, and that
         the check is made with the node type ids of both.
         */
        test('_TC207_createNode_rejectsChildTypeNotAllowedUnderParent', async () => {
            nodes.findById.mockResolvedValue(makeNode({ id: 5, nodeTypeId: 100 }));
            nodeTypes.isAllowedChild.mockResolvedValue(false);

            await expect(service.createNode(makeRequest())).rejects.toThrow("Node type 'processgrupp' is not allowed under this parent");
            expect(nodeTypes.isAllowedChild).toHaveBeenCalledWith(100, 200);
            expect(nodes.createNode).not.toHaveBeenCalled();
        });
    });


    describe('createNode - reference code and save', () => {

        /*
         Verifies that a reference code that is already used under the same parent gives a
         ConflictError and nothing is created.
         */
        test('_TC208_createNode_rejectsDuplicateReferenceCode', async () => {
            nodes.existsByStructureParentAndReferenceCode.mockResolvedValue(true);
            const request = makeRequest({ referenceCode: 'A.1' });

            await expect(service.createNode(request)).rejects.toThrow(ConflictError);
            expect(nodes.existsByStructureParentAndReferenceCode).toHaveBeenCalledWith(10, 5, 'A.1');
            expect(nodes.createNode).not.toHaveBeenCalled();
        });


        /*
         Verifies that a node without reference code skips the duplicate check, and that the
         created node is returned.
         */
        test('_TC209_createNode_skipsDuplicateCheckWithoutReferenceCode', async () => {
            const result = await service.createNode(makeRequest({ referenceCode: null }));

            expect(nodes.existsByStructureParentAndReferenceCode).not.toHaveBeenCalled();
            expect(result.id).toBe(99);
        });


        /*
         Verifies the full happy path: the node is built from the request and the node type id,
         and the property values are saved with the SAME trx, the creating user and
         requireAll = true (every required field must be present when a node is created).
         */
        test('_TC210_createNode_savesNodeAndPropertiesInSameTransaction', async () => {
            const inputs = [{ key: 'beskrivning', value: 'Text' }];

            await service.createNode(makeRequest({ referenceCode: 'A.1', properties: inputs }));

            expect(knex.transaction).toHaveBeenCalledTimes(1);
            expect(nodes.createNode).toHaveBeenCalledWith(expect.objectContaining({
                structureId: 10, parentId: 5, nodeTypeId: 200, referenceCode: 'A.1', title: 'Ny nod', createdBy: 7,
            }));
            expect(properties.saveValuesInTransaction).toHaveBeenCalledWith(trx, expect.objectContaining({ id: 99 }), inputs, 7, true);
        });


        /*
         Verifies that an invalid property value makes createNode fail with that error: the
         error leaves the transaction callback, so the real knex rolls the new node back.
         */
        test('_TC211_createNode_propagatesPropertyErrorSoTheTransactionRollsBack', async () => {
            properties.saveValuesInTransaction.mockRejectedValue(new ValidationError("Field 'Namn' is required"));

            await expect(service.createNode(makeRequest())).rejects.toThrow("Field 'Namn' is required");
        });
    });
});
