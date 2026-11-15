/**
 Unit tests for NodeActivityService (the Aktiviteter tab of a process node).
 Like the structure service it builds its own repositories, so NodeRepository,
 NodeTypeRepository and NodeActivityRepository are replaced with jest.mock.
 knex.transaction runs the callback right away with a jest.fn() as trx. Nothing here
 touches any db.
 Covers list (mapping + checklist ids) and the main paths of replace: wrong node type and
 a full replace with sort order and trimming.


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
import type { NodeActivity } from '../models/node/nodeActivity';
import type { NodeType } from '../models/node/nodeType';
import { NodeActivityRepository } from '../repos/nodeActivityRepository';
import { NodeRepository } from '../repos/nodeRepository';
import { NodeTypeRepository } from '../repos/nodeTypeRepository';
import { ValidationError } from '../services/errorService';
import { NodeActivityService } from '../services/nodeActivityService';


jest.mock('../repos/nodeRepository', () => ({ NodeRepository: jest.fn() }));
jest.mock('../repos/nodeTypeRepository', () => ({ NodeTypeRepository: jest.fn() }));
jest.mock('../repos/nodeActivityRepository', () => ({ NodeActivityRepository: jest.fn() }));


// setup for the tests

const makeNode = (overrides: Partial<Node> = {}): Node => ({
    id: 1,
    structureId: 10,
    parentId: null,
    nodeTypeId: 100,
    referenceCode: null,
    previousReferenceCode: null,
    title: 'Process',
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

const makeNodeType = (overrides: Partial<NodeType> = {}): NodeType => ({
    id: 100,
    code: 'process',
    name: 'Process',
    structureType: 'klassificering',
    eadLevel: 'otherlevel',
    eadOtherlevel: 'process',
    eadUnitDescription: null,
    description: null,
    isActive: true,
    ...overrides,
});

const makeActivity = (overrides: Partial<NodeActivity> = {}): NodeActivity => ({
    id: 50,
    nodeId: 1,
    name: 'Aktivitet',
    description:null,
    structureUnitNodeId: null,
    structureUnitText: null,
    sortOrder: 0,
    ...overrides,
});


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('NodeActivityService', () => {
    let nodes: { findById: jest.Mock };
    let nodeTypes: { findOne: jest.Mock };
    let activities: {
        findByNodeId: jest.Mock;
        findHandlingstypIds:jest.Mock;
        deleteByNodeId: jest.Mock;
        create: jest.Mock;
        addHandlingstyp: jest.Mock;
    };
    let trx: jest.Mock;
    let knex: Knex;
    let service: NodeActivityService;

    beforeEach(() => {
        jest.clearAllMocks();

        nodes = { findById: jest.fn() };
        nodeTypes ={ findOne: jest.fn() };
        activities = {
            findByNodeId: jest.fn(),
            findHandlingstypIds: jest.fn(),
            deleteByNodeId: jest.fn(),
            create: jest.fn(),
            addHandlingstyp: jest.fn(),
        };

        jest.mocked(NodeRepository).mockImplementation(() => nodes as unknown as NodeRepository);
        jest.mocked(NodeTypeRepository).mockImplementation(() => nodeTypes as unknown as NodeTypeRepository);
        jest.mocked(NodeActivityRepository).mockImplementation(() => activities as unknown as NodeActivityRepository);

        nodes.findById.mockResolvedValue(makeNode());
        nodeTypes.findOne.mockResolvedValue(makeNodeType());
        activities.findByNodeId.mockResolvedValue([]);
        activities.findHandlingstypIds.mockResolvedValue(new Map());

        trx = jest.fn();
        knex = {
            transaction: jest.fn(async (cb: (t: unknown) => Promise<unknown>) => cb(trx)),
        } as unknown as Knex;

        service = new NodeActivityService(knex);

    });



    describe('list', () => {

        /*
         Verifies how the rows are turned into dtos: the checklist ids are attached per
         activity, an activity with no checklist gets an empty list (not undefined), and
         missing strukturenhet fields come out as null.
         */
        test('_TC050_list_mapsActivitiesWithTheirChecklist', async () => {
            activities.findByNodeId.mockResolvedValue([
                makeActivity({ id: 50, name: 'Diarieföra', structureUnitNodeId: 70, structureUnitText: 'Kansliet' }),
                makeActivity({
                    id: 51,
                    name: 'Arkivera',
                    sortOrder: 1,
                    structureUnitNodeId: undefined as unknown as null,
                    structureUnitText: undefined as unknown as null,
                }),

            ]);
            activities.findHandlingstypIds.mockResolvedValue(new Map([[50, [7, 8]]]));

            const result = await service.list(1);
            expect(activities.findHandlingstypIds).toHaveBeenCalledWith([50, 51]);
            expect(result).toEqual([
                {
                    id:50,
                    name: 'Diarieföra',
                    description: null,
                    sortOrder: 0,
                    handlingstypNodeIds: [7, 8],
                    structureUnitNodeId: 70,
                    structureUnitText: 'Kansliet',
                },
                {
                    id: 51,
                    name: 'Arkivera',
                    description: null,
                    sortOrder: 1,
                    handlingstypNodeIds: [],
                    structureUnitNodeId: null,
                    structureUnitText: null,
                },

            ]);
        });

    });



    describe('replace', () => {

        /*
         Verifies that only process nodes have activities, trying it on for example a
         handlingsslag gives a ValidationError and nothing is deleted.
         */
        test('_TC051_replace_rejectsNodeTypeWithoutActivities', async () => {
            nodeTypes.findOne.mockResolvedValue(makeNodeType({ code: 'handlingsslag' }));

            await expect(service.replace(1, [{ name: 'X' }])).rejects.toThrow(ValidationError);
            await expect(service.replace(1, [{ name: 'X' }])).rejects.toThrow('This node type has no activities');
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();

        });


        /*
         Verifies a full replace: the old list is deleted, every input is created in the
         order of the array (that order becomes sortOrder), names and texts are trimmed,
         an empty description is saved as null and each activity gets its (empty) checklist.
         No checklist ids or strukturenhet refs are sent, so no extra queries run.
         Afterwards the fresh list is returned.
         */
        test('_TC052_replace_deletesOldAndCreatesNewInOrder', async () => {
            activities.create
                .mockResolvedValueOnce(makeActivity({ id: 60 }))
                .mockResolvedValueOnce(makeActivity({ id: 61 }));
            activities.findByNodeId.mockResolvedValue([makeActivity({ id: 60 }), makeActivity({ id: 61, sortOrder: 1 })]);

            const result = await service.replace(1, [
                { name: '  Diarieföra ', description: '   ' },
                { name: 'Arkivera', description: ' Till arkivet ', structureUnitText: ' Kansliet ' },
            ]);

            expect(activities.deleteByNodeId).toHaveBeenCalledWith(1);
            expect(activities.create).toHaveBeenNthCalledWith(1, {
                nodeId: 1,
                name: 'Diarieföra',
                description: null,
                structureUnitNodeId:  null,
                structureUnitText: null,
                sortOrder: 0,
            });
            expect(activities.create).toHaveBeenNthCalledWith(2,{
                nodeId: 1,
                name: 'Arkivera',
                description: 'Till arkivet',
                structureUnitNodeId: null,
                structureUnitText: 'Kansliet',
                sortOrder: 1,

            });

            expect(activities.addHandlingstyp).toHaveBeenCalledWith(60, []);
            expect(activities.addHandlingstyp).toHaveBeenCalledWith(61, []);
            expect(trx).not.toHaveBeenCalled();
            expect(result.map((a) =>a.id)).toEqual([60, 61]);
        });

    });


});
