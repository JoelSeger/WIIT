/**
  Unit tests for SearchService.
 The repository is mocked with jest.fn() - these cover the service'sorchestration logic (ranking, path resolution, pagination, publicOnly
 filtering, snippet extraction). The SQL that SearchRepository runs is
 tested separately in searchRepository.test.ts against a real in-memory
 SQLite DB.
 Test Naming Convention: _TCnnn_<function>_<description> for verification-doc match.
 */


import type { SearchInput } from '../models/search/search';
import type {
    NodeHitRow,
    SearchRepository,
    SkeletonRow,
    ValueHitRow,
} from '../repos/searchRepository';
import {
    escapeLike,
    MAX_CANDIDATES,
    SearchService,
} from '../services/searchService';


// setup for tests

const makeNode = (overrides: Partial<NodeHitRow> = {}): NodeHitRow => ({
    id: 1,
    structureId: 10,
    structureName: 'Arkiv',
    structureType: 'EAD3',
    parentId: null,
    title: 'Node',
    referenceCode: null,
    description: null,
    nodeTypeCode: 'series',
    nodeTypeName: 'Series',
    ...overrides,
});

const makeSkeleton = (overrides: Partial<SkeletonRow> = {}): SkeletonRow => ({
    id: 1,
    parentId: null,
    title: 'Skeleton',
    referenceCode: null,
    isPublished: true,
    ...overrides,
});

const makeValueHit = (overrides: Partial<ValueHitRow> = {}): ValueHitRow => ({
    nodeId: 1,
    label: 'Property',
    valueText: 'value',
    ...overrides,
});

const makeInput = (overrides: Partial<SearchInput> = {}): SearchInput => ({
    q: 'hello',
    limit: 10,
    offset: 0,
    ...overrides,
});

// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('SearchService', () => {
    let repo: jest.Mocked<SearchRepository>;
    let service: SearchService;

    beforeEach(() => {
        repo = {
            findNodeMatches: jest.fn(),
            findValueMatches: jest.fn(),
            findNodesByIds: jest.fn(),
            findSkeleton: jest.fn(),
        } as unknown as jest.Mocked<SearchRepository>;

        service = new SearchService(repo);
    });



    describe('escapeLike', () => {

        /* Verifies that '%' is escaped so it is treated as a literal in LIKE patterns. */
        test('_TC001_escapeLike_escapesPercent', () => {
            expect(escapeLike('50%')).toBe('50\\%');
        });


        /* Verifies that '_' is escaped so it does not act as a single-char wildcard. */
        test('_TC002_escapeLike_escapesUnderscore', () => {
            expect(escapeLike('a_b')).toBe('a\\_b');
        });


        /* Verifies that '[' is escaped (MSSQL treats it as a bracket-expression opener). */
        test('_TC003_escapeLike_escapesBracket', () => {
            expect(escapeLike('a[b')).toBe('a\\[b');

        });


        /* Verifies that '\' is escaped to prevent it from acting as an escape character. */
        test('_TC004_escapeLike_escapesBackslash', () => {
            expect(escapeLike('a\\b')).toBe('a\\\\b');

        });

        /* Verifies that characters with no LIKE meaning pass through unchanged. */
        test('_TC005_escapeLike_leavesOrdinaryCharsAlone', () => {
            expect(escapeLike('abc-123')).toBe('abc-123');
        });
    });



    describe('search - empty and filter building', () => {

        /*
         Verifies that when both repository queries return no hits, the response
         has total=0, empty results, and truncated=false, and that no further
         repository calls (findNodesByIds, findSkeleton) are made.
         */
        test('_TC006_search_returnsEmptyResponseWhenNoMatches', async () =>{
            repo.findNodeMatches.mockResolvedValue([]);
            repo.findValueMatches.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'nothing' }), false);

            expect(result.total).toBe(0);
            expect(result.results).toEqual([]);
            expect(result.truncated).toBe(false);
            expect(result.query).toBe('nothing');
            expect(repo.findNodesByIds).not.toHaveBeenCalled();
            expect(repo.findSkeleton).not.toHaveBeenCalled();

        });


        /*
         Verifies that leading/trailing whitespace is trimmed from the query and
         that the resulting LIKE pattern wraps the escaped query in '%...%'.
         */
        test('_TC007_search_trimsQueryAndEscapesPattern', async () => {
            repo.findNodeMatches.mockResolvedValue([]);
            repo.findValueMatches.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: '  50%  ' }), false);
            expect(result.query).toBe('50%');
            expect(repo.findNodeMatches).toHaveBeenCalledWith(
                expect.objectContaining({ pattern: '%50\\%%' }),
            );
        });



        /*
         Verifies that all filter fields (pattern, publicOnly, structureType,
         structureId, limit) are forwarded to both repository search methods.
         */
        test('_TC008_search_passesAllFilterFieldsToRepository', async() => {
            repo.findNodeMatches.mockResolvedValue([]);
            repo.findValueMatches.mockResolvedValue([]);

            await service.search(
                makeInput({ q: 'x', structureType: 'EAD3', structureId: 42 }),
                true,
            );

            const expectedFilter = {
                pattern: '%x%',
                publicOnly: true,
                structureType: 'EAD3',
                structureId: 42,
                limit: MAX_CANDIDATES,
            };
            expect(repo.findNodeMatches).toHaveBeenCalledWith(expectedFilter);
            expect(repo.findValueMatches).toHaveBeenCalledWith(expectedFilter);

        });
    });



    describe('search - basic matches', () => {

        /*
         Verifies that a node matched by title produces a 'title' entry in
         matches with label "Titel" and the full title as snippet.
         */
        test('_TC009_search_nodeHitByTitleExposesTitleMatch', async () => {
            repo.findNodeMatches.mockResolvedValue([1]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([makeNode({ id: 1, title: 'Hello World' })]);
            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].matches).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'title', label: 'Titel', snippet: 'Hello World' }),
                ]),
            );
        });


        /*
         Verifies that a node matched by referenceCode produces a
         'referenceCode' entry in matches with the full reference as snippet.
         */
        test('_TC010_search_nodeHitByReferenceCodeExposesReferenceMatch', async () => {
            repo.findNodeMatches.mockResolvedValue([1]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 1, title: 'Other', referenceCode: 'REF-hello-1' }),
            ]);
            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results[0].matches).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'referenceCode', snippet: 'REF-hello-1' }),
                ]),

            );

        });


        /*
         Verifies that a description match strips <br/> tags, collapses
         consecutive whitespace, and returns a single-line snippet.
         */
        test('_TC011_search_descriptionMatchFlattensBrAndProducesSnippet', async () => {
            repo.findNodeMatches.mockResolvedValue([1]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 1, title: 'Other', description: 'line1<br/>line2 hello end' }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            const snippet = result.results[0].matches.find((m) => m.field === 'description')?.snippet;
            expect(snippet).toBe('line1 line2 hello end');

        });


        /*
         Verifies that property-value hits are attached to the result's matches
         array as 'property' entries with the property's label preserved.
         */
        test('_TC012_search_propertyHitsAttachAsMatches', async () => {
            repo.findNodeMatches.mockResolvedValue([]);
            repo.findValueMatches.mockResolvedValue([
                makeValueHit({ nodeId: 20, label: 'Anmärkning', valueText: 'contains hello here' }),
            ]);

            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 20, title: 'Other', description: null }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].matches).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: 'property', label: 'Anmärkning' }),
                ]),
            );


        });


        /*
         Verifies that when the same node id appears in both node-hits and
         value-hits, findNodesByIds is called once with a de-duplicated id list.
         */
        test('_TC013_search_deduplicatesNodeSeenInBothHits', async () => {
            repo.findNodeMatches.mockResolvedValue([30]);
            repo.findValueMatches.mockResolvedValue([makeValueHit({ nodeId: 30 })]);
            repo.findNodesByIds.mockResolvedValue([makeNode({ id: 30, title: 'hello' })]);
            repo.findSkeleton.mockResolvedValue([]);

            await service.search(makeInput({ q: 'hello' }), false);
            expect(repo.findNodesByIds).toHaveBeenCalledWith([30]);
        });

    });



    describe('search - publicOnly filtering', () => {
        const setup = (isParentPublished: boolean) => {
            repo.findNodeMatches.mockResolvedValue([40]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 40, parentId:39, title: 'Child hello' }),
            ]);

            repo.findSkeleton.mockResolvedValue([
                makeSkeleton({ id: 39, parentId: null, isPublished: isParentPublished }),
            ]);
        };


        /*
         Verifies that with publicOnly=true, a hit is excluded when any ancestor
         in its path is unpublished (matches tree-hiding behaviour).
         */
        test('_TC014_search_skipsNodeUnderUnpublishedAncestorWhenPublicOnly', async () => {
            setup(false);
            const result = await service.search(makeInput({ q: 'hello' }), true);
            expect(result.results).toHaveLength(0);
        });


        /*
         Verifies that with publicOnly=false, the same node under an unpublished
         ancestor is still returned (admin view behaviour).
         */
        test('_TC015_search_keepsSameNodeWhenPublicOnlyIsFalse', async () => {
            setup(false);
            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results).toHaveLength(1);
        });
    });



    describe('search - path resolution', () => {
        /*
         Verifies that the resolved path lists ancestors root-first
         (root, parent) and does not include the hit node itself.
         */
        test('_TC016_search_buildsPathRootFirst', async () =>{
            repo.findNodeMatches.mockResolvedValue([5]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 5, parentId: 3, title: 'hello' }),
            ]);

            repo.findSkeleton.mockResolvedValue([
                makeSkeleton({ id: 3, parentId: 1, title: 'Parent' }),
                makeSkeleton({ id: 1, parentId: null, title: 'Root' }),
            ]);
            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results[0].path.map((p) => p.id)).toEqual([1, 3]);
        });



        /*
         Verifies that a hit is dropped when its parent id is not present in
         the skeleton (broken parent chain / orphaned node).
         */
        test('_TC017_search_skipsNodeWithBrokenParentChain', async () => {
            repo.findNodeMatches.mockResolvedValue([6]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 6, parentId: 999, title: 'hello' }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results).toHaveLength(0);

        });


        /*
         Verifies that a hit is dropped when walking up the parent chain
         detects a cycle (protects against broken data).
         */
        test('_TC018_search_skipsNodeWithParentCycle', async () => {
            repo.findNodeMatches.mockResolvedValue([5]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 5, parentId: 8, title: 'hello' }),
            ]);
            repo.findSkeleton.mockResolvedValue([
                makeSkeleton({ id: 7, parentId: 8 }),
                makeSkeleton({ id: 8, parentId: 7 }),
            ]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results).toHaveLength(0);
        });
    });


    describe('search - ranking and sorting', () => {

        /*
         Verifies that an exact reference-code match (rank 100) sorts above an
         exact title match (rank 80).
         */
        test('_TC019_search_exactReferenceRanksAboveExactTitle', async () => {

            repo.findNodeMatches.mockResolvedValue([1, 2]);
            repo.findValueMatches.mockResolvedValue([]) ;
            repo.findNodesByIds.mockResolvedValue([

                makeNode({ id: 1, title: 'hello', referenceCode: null }),
                makeNode({ id: 2, title: 'Other', referenceCode: 'hello' }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);
            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results.map((r) => r.nodeId)).toEqual([2, 1]);
        }
        );


        /*
         Verifies that a title that starts with the query (rank 60) sorts above
         a title that merely contains it (rank 40).
         */
        test('_TC020_search_titleStartsWithRanksAboveContains', async () => {
            repo.findNodeMatches.mockResolvedValue([1, 2]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id:1, title: 'say hello loudly'}),
                makeNode({ id: 2, title: 'hello world' }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(
                makeInput({ q: 'hello' }), false);
            expect(result.results.map((r) => r.nodeId)).toEqual([2, 1]);
        });



        /*
         Verifies that ties on score are broken by title using Swedish locale
         collation (ape before zebra).
         */
        test('_TC021_search_breaksScoreTiesByTitle', async () => {
            repo.findNodeMatches.mockResolvedValue([1, 2]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 1, title: 'zebra hello' }),
                makeNode({ id: 2, title: 'ape hello' }),
            ]);
            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            expect(result.results.map((r) => r.title)).toEqual(['ape hello', 'zebra hello']);
        });


        /*
         Verifies that remaining ties on both score and title are broken by
         ascending nodeId as a deterministic final tiebreaker.
         */
        test('_TC022_search_breaksTitleTiesByNodeId', async () => {
            repo.findNodeMatches.mockResolvedValue([5, 3]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 5, title: 'hello' }),
                makeNode({ id: 3, title: 'hello' }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(
                makeInput({ q: 'hello' }), false);
            expect(result.results.map((r) => r.nodeId)).toEqual([3, 5]);
        });
    });



    describe('search - truncation and pagination', () => {
        /*
         Verifies that when findNodeMatches returns exactly MAX_CANDIDATES rows,
         the response is marked truncated=true (candidate window was exhausted).
         */
        test('_TC023_search_marksTruncatedWhenNodeHitsReachMax', async () => {
            repo.findNodeMatches.mockResolvedValue(
                Array.from({ length: MAX_CANDIDATES }, (_, i) => i + 1),
            );
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([]);
            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput(), false);
            expect(result.truncated).toBe(true);
        });


        /*
         Verifies that when findValueMatches returns exactly MAX_CANDIDATES rows,
         the response is marked truncated=true as well.
         */
        test('_TC024_search_marksTruncatedWhenValueHitsReachMax', async () => {
            repo.findNodeMatches.mockResolvedValue([]);
            repo.findValueMatches.mockResolvedValue(
                Array.from({ length: MAX_CANDIDATES }, (_, i) => makeValueHit({ nodeId: i + 1 })),
            );
            repo.findNodesByIds.mockResolvedValue([]);
            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput(), false);
            expect(result.truncated).toBe(true);
        });


        /*
        Verifies that offset and limit slice the sorted results, while
        total still reflects the full result count before pagination.
        */
        test('_TC025_search_respectsOffsetAndLimit', async () => {
            repo.findNodeMatches.mockResolvedValue([1, 2, 3, 4, 5]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue(
                [1, 2, 3, 4, 5].map((id) => makeNode({ id, title: 'hello' })),
            );
            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(
                makeInput({ q: 'hello', limit: 2, offset: 1 }),
                false,
            );

            expect(result.total).toBe(5);
            expect(result.results).toHaveLength(2);
            expect(result.results.map((r) => r.nodeId)).toEqual([2, 3]);
            expect(result.limit).toBe(2);
            expect(result.offset).toBe(1);
        });
    });



    describe('search - snippet truncation', () =>{

        /*
         Verifies that a description longer than the snippet window is shortened with
         leading/trailing ellipses, still contains the query term, and is shorter than the original description.
         */
        test('_TC026_search_longDescriptionIsTruncatedWithEllipses', async () => {
            const description = 'x'.repeat(100) + ' hello ' + 'y'.repeat(100);
            repo.findNodeMatches.mockResolvedValue([1]);
            repo.findValueMatches.mockResolvedValue([]);
            repo.findNodesByIds.mockResolvedValue([
                makeNode({ id: 1, title: 'Other', description }),
            ]);

            repo.findSkeleton.mockResolvedValue([]);

            const result = await service.search(makeInput({ q: 'hello' }), false);
            const snippet =
                result.results[0].matches.find((m) => m.field === 'description')?.snippet ?? '';

            expect(snippet).toContain('hello');
            expect(snippet.startsWith('…')).toBe(true);
            expect(snippet.endsWith('…')).toBe(true);
            expect(snippet.length).toBeLessThan(description.length);
        });

    });
});