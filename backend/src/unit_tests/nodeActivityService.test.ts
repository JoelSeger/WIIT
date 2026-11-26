/**
 Unit tests for NodeActivityService (the Aktiviteter tab of a node, for example a process).
 Which node types have activities is now data: node_types.has_activities (migration 012),
 not a fixed check on the 'process' code anymore.
 Like the structure service it builds its own repositories, so NodeRepository,
 NodeTypeRepository and NodeActivityRepository are replaced with jest.mock.
 knex.transaction runs the callback right away with a jest.fn() as trx, which gives back
 a fake query builder (makeQuery) for the two raw checks in replace. Nothing here touches
 any db.
 Covers list (missing node, mapping + checklist ids) and replace from start to end: missing
 node, node type without activities or missing, the checklist checks (right type and below
 the node), the strukturenhet check, ids used twice, blank names and a full replace with
 sort order and trimming.


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
import { NotFoundError, ValidationError } from '../services/errorService';
import { NodeActivityService } from '../services/nodeActivityService';


jest.mock('../repos/nodeRepository', () => ({ NodeRepository: jest.fn() }));
jest.mock('../repos/nodeTypeRepository', () => ({ NodeTypeRepository: jest.fn() }));
jest.mock('../repos/nodeActivityRepository', () => ({ NodeActivityRepository: jest.fn() }));


// Setup for the tests

const makeNode = (overrides: Partial<Node> = {}): Node =>({
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

const makeNodeType = (overrides: Partial<NodeType> = {}): NodeType =>({

    id: 100,
    code: 'process',
    name: 'Process',
    structureType: 'klassificering',
    eadLevel: 'otherlevel',
    eadOtherlevel:'process',
    eadUnitDescription: null,
    description:null,
    isActive:true,
    canBeRoot: false,
    hasActivities:true,
    ...overrides,

});

const makeActivity =(overrides: Partial<NodeActivity> = {}): NodeActivity =>({
    id: 50,
    nodeId: 1,
    name: 'Aktivitet',
    description:null,
    structureUnitNodeId: null,
    structureUnitText: null,
    sortOrder: 0,
    ...overrides,

});

//// Fake knex query builder for the raw trx(...) queries in replace:every chain method returns the same object
//// and select()gives back the rows
const makeQuery = (rows: { id: number }[]) =>{
    const q = {
        join: jest.fn(),
        where: jest.fn(),
        whereIn: jest.fn(),
        select: jest.fn().mockResolvedValue(rows),

    };
    q.join.mockReturnValue(q);
    q.where.mockReturnValue(q);
    q.whereIn.mockReturnValue(q);
    return q;

};


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('NodeActivityService', () =>{

    let nodes: { findById: jest.Mock;
        filterDescendantsOf: jest.Mock };
    let nodeTypes: { findOne: jest.Mock };
    let activities: {
        findByNodeId: jest.Mock;
        findHandlingstypIds:jest.Mock;
        deleteByNodeId: jest.Mock;
        create: jest.Mock;
        addHandlingstyp: jest.Mock; };

    let trx: jest.Mock;
    let knex: Knex;
    let service: NodeActivityService;

    beforeEach(() => {
        jest.clearAllMocks();

        nodes= { findById: jest.fn(),filterDescendantsOf: jest.fn() };
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
        //Bydefault every id we ask about is below the node!
        nodes.filterDescendantsOf.mockImplementation(async(_nodeId: number, ids: number[]) => new Set(ids));
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
                }, {
                    id: 51,
                    name: 'Arkivera',
                    description: null,
                    sortOrder: 1,
                    handlingstypNodeIds: [],
                    structureUnitNodeId: null,
                    structureUnitText:null,
                },

            ]);
        });



        /*
         Verifies that asking for the activities of a node that doesn't exist throws
         a NotFoundError, and no activities are loaded.
         */
        test('_TC063_list_throwsWhenNodeMissing', async () =>{
            nodes.findById.mockResolvedValue(undefined);

            await expect(service.list(999)).rejects.toThrow(NotFoundError);
            await expect(service.list(999)).rejects.toThrow('Node 999 was not found') ;
            expect(activities.findByNodeId).not.toHaveBeenCalled();

        });

    });



    describe('replace', () =>{
        /*
         Verifies that only node types with hasActivities set can have activities, trying it on
         for example a handlingsslag (hasActivities false) gives a ValidationError and nothing
         is deleted.
         */
        test('_TC051_replace_rejectsNodeTypeWithoutActivities', async () =>{
            nodeTypes.findOne.mockResolvedValue(makeNodeType({ code: 'handlingsslag', hasActivities: false }));

            await expect(service.replace(1, [{ name: 'X' }])).rejects.toThrow(ValidationError);
            await expect(service.replace(1, [{ name: 'X' }])).rejects.toThrow('This node type has no activities');
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();

        });


        /*
         Verifies a full replace: the old list is deleted, every input is created in the
         order of the array (that order becomes sortOrder), names and texts are trimmed,
         an empty description is saved as null and each activity gets its empty checklist.
         No checklist ids or strukturenhet refs are sent, so no extra queries run.
         After that the fresh list is returned.
         */
        test('_TC052_replace_deletesOldAndCreatesNewInOrder', async () =>{
            activities.create
                .mockResolvedValueOnce(makeActivity({ id: 60 }))
                .mockResolvedValueOnce(makeActivity({ id: 61 })) ;
            activities.findByNodeId.mockResolvedValue([makeActivity({ id: 60 }), makeActivity({ id: 61, sortOrder: 1 })]);

            const result = await service.replace(1, [
                {name: '  Diarieföra ', description: '   '},
                { name: 'Arkivera', description: ' Till arkivet ', structureUnitText: ' Kansliet ' },
            ]);

            expect(activities.deleteByNodeId).toHaveBeenCalledWith(1);
            expect(activities.create).toHaveBeenNthCalledWith(1,{
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

            expect(activities.addHandlingstyp).toHaveBeenCalledWith(60,[]);
            expect(activities.addHandlingstyp).toHaveBeenCalledWith(61, []);

            expect(trx).not.toHaveBeenCalled();
            expect(result.map((a) =>a.id)).toEqual([60, 61]);
        });



        /*
         Verifies that replace on a node that doesn't exist throws NotFoundError
         and the old activities are left alone (nothing deleted).
         */
        test('_TC064_replace_throwsWhenNodeMissing', async () =>{
            nodes.findById.mockResolvedValue(undefined);

            await expect(service.replace(999, [])).rejects.toThrow(NotFoundError);
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();

        });


        /*
         Verifies that a node whose node type can't be found is treated like a node type
         without activities, ValidationError and nothing deleted.
         */
        test('_TC065_replace_rejectsWhenNodeTypeMissing', async () =>{
            nodeTypes.findOne.mockResolvedValue(undefined);

            await expect(service.replace(1, [{ name: 'X'}])).rejects.toThrow('This node type has no activities');
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();

        });


        /*
         Verifies the checklist check: both ids are handlingstyp, but 8 is not somewhere below
         this node, so filterDescendantsOf only gives back 7 and we get a ValidationError
         before anything is deleted.
         */
        test('_TC066_replace_rejectsChecklistIdOutsideTheNode', async () => {
            const checklistQuery = makeQuery([{ id: 7 }, { id: 8 }]);

            trx.mockReturnValueOnce(checklistQuery);
            nodes.filterDescendantsOf.mockResolvedValue(new Set([7])); //(only 7 is below node 1)

            await expect(
                service.replace(1, [{name: 'Diarieföra', handlingstypNodeIds: [7, 8] }]),
            ).rejects.toThrow('The checklist may only contain handlingstyp nodes that belong to this node');

            expect(trx).toHaveBeenCalledWith('nodes as n');
            expect(checklistQuery.where).toHaveBeenCalledWith('t.code', 'handlingstyp');
            expect(checklistQuery.whereIn).toHaveBeenCalledWith('n.id', [7, 8]);
            expect(nodes.filterDescendantsOf).toHaveBeenCalledWith(1, [7, 8]);
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();

        });


        /*
         Verifies the other half of the checklist check: id 8 is not a handlingstyp at all, so
         the type query leaves it out and only 7 is sent on to filterDescendantsOf. Fewer ids
         than asked for gives a ValidationError and nothing is deleted.
         */
        test('_TC291_replace_rejectsChecklistIdOfWrongType', async () =>{
            const checklistQuery = makeQuery([{ id: 7}]);
            trx.mockReturnValueOnce(checklistQuery);

            await expect(
                service.replace(1, [{ name: 'Diarieföra', handlingstypNodeIds: [7, 8] }]),
            ).rejects.toThrow('The checklist may only contain handlingstyp nodes that belong to this node');

            expect(nodes.filterDescendantsOf).toHaveBeenCalledWith(1, [7]);
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();


        });



        /*
         Verifies that it is the hasActivities flag that counts and not the type code: a
         handlingsslag with the flag set (1, like SQLite gives it back) is allowed to have
         activities.
         */

        test('_TC292_replace_allowsAnyNodeTypeWithHasActivities', async () =>
        {
            nodeTypes.findOne.mockResolvedValue(makeNodeType({ code: 'handlingsslag', hasActivities: 1 }));
            activities.create.mockResolvedValueOnce(makeActivity({ id: 60 }));

            await service.replace(1, [{ name: 'Diarieföra' }]);
            expect(activities.deleteByNodeId).toHaveBeenCalledWith(1);
            expect(activities.create).toHaveBeenCalledTimes(1);

        });


        /*
         Verifies the strukturenhet check: a structureUnitNodeId that points at a node of
         another type is not found by the query, so we get a ValidationError and nothing
         is deleted.
         */
        test('_TC067_replace_rejectsStructureUnitOfWrongType', async() =>{
            const unitQuery = makeQuery([]);
            trx.mockReturnValueOnce(unitQuery);

            await expect(
                service.replace(1, [{ name: 'Diarieföra', structureUnitNodeId: 99 }]),
            ).rejects.toThrow('structureUnitNodeId must be a strukturenhet node');

            expect(unitQuery.where).toHaveBeenCalledWith('t.code', 'strukturenhet');
            expect(unitQuery.whereIn).toHaveBeenCalledWith('n.id', [99]);
            expect(activities.deleteByNodeId).not.toHaveBeenCalled();

        });


        /*
         Verifies that ids used more than once are only checked once: two activities share
         a checklist id and a strukturenhet, so each query gets the unique ids. Also the
         checklist of one activity is saved without its duplicate.
         */
        test('_TC068_replace_checksEachIdOnlyOnce', async () =>{

            const checklistQuery = makeQuery([{ id: 7 }, { id: 8 }]);
            const unitQuery = makeQuery([{ id: 70 }]);
            trx.mockReturnValueOnce(checklistQuery).mockReturnValueOnce(unitQuery);
            activities.create
                .mockResolvedValueOnce(makeActivity({ id: 60 }))
                .mockResolvedValueOnce(makeActivity({id: 61 }));

            await service.replace(1, [
                { name: 'Diarieföra', handlingstypNodeIds: [7,7, 8], structureUnitNodeId: 70 },
                { name: 'Arkivera', handlingstypNodeIds: [8], structureUnitNodeId: 70 },

            ]);

            expect(checklistQuery.whereIn).toHaveBeenCalledWith('n.id', [7,8]);
            expect(nodes.filterDescendantsOf).toHaveBeenCalledWith(1, [7, 8]);
            expect(unitQuery.whereIn).toHaveBeenCalledWith('n.id', [70]);

            expect(activities.create).toHaveBeenNthCalledWith(1,expect.objectContaining({structureUnitNodeId: 70 }));
            expect(activities.addHandlingstyp).toHaveBeenCalledWith(60, [7,8]);
            expect(activities.addHandlingstyp).toHaveBeenCalledWith (61, [8]);

        });



        /*
         Verifies that every activity needs a name, a blank one gives a ValidationError.
         Note: the old list is already deleted at that point, in the real db the
         transaction rolls that back, here we only check that the bad one is never created.
         */
        test('_TC069_replace_rejectsActivityWithBlankName', async () =>{
            activities.create.mockResolvedValueOnce(makeActivity({ id: 60 }));

            await expect(service.replace(1, [{ name: 'Diarieföra' }, { name: '   '}]),
            ).rejects.toThrow('Every activity needs a name');

            expect(activities.create).toHaveBeenCalledTimes(1);

        });

    });


});
