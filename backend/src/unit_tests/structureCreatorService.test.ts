/**
 Unit tests for StructureCreationService (services/structureCreatorService.ts).
 The service builds its repositories itself (new XRepository(knex, trx)), so the four
 repository modules are replaced with jest.mock and every "new" gets back a plain object
 full of jest.fn(). knex.transaction is faked too, it just runs the callback right away
 with a dummy trx. Nothing here touches any db.
 Covers create from start to end: the checks on code and name, the duplicate code check,
 picking an existing archive or making a new one, picking an existing archive creator or
 making a new one, the "both/neither given" checks, the default values the new structure
 gets and the link row between archive and structure.


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
import type { Archive } from '../models/archive/archive';
import type { ArchiveCreator } from '../models/archive/archiveCreator';
import type { Structure } from '../models/structure/structure';
import type { CreateStructureRequest } from '../types/structureCreation.types';
import { ArchiveCreatorRepository } from '../repos/archiveCreatorRepository';
import { ArchiveRepository } from '../repos/archiveRepository';
import { ArchiveStructureRepository } from '../repos/archiveStructureRepository';
import { StructureRepository } from '../repos/structureRepository';
import { ConflictError, NotFoundError, ValidationError } from '../services/errorService';
import { StructureCreationService } from '../services/structureCreatorService';


// the repo classes become empty jest.fn() constructors, what they return is set in beforeEach
jest.mock('../repos/archiveCreatorRepository', () => ({ ArchiveCreatorRepository: jest.fn() }));
jest.mock('../repos/archiveRepository', () => ({ ArchiveRepository: jest.fn() }));
jest.mock('../repos/archiveStructureRepository', () => ({ ArchiveStructureRepository: jest.fn() }));
jest.mock('../repos/structureRepository', () => ({ StructureRepository: jest.fn() }));


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

const makeArchive = (overrides: Partial<Archive> = {}): Archive => ({
    id: 20,
    archiveCreatorId: 30,
    referenceCode: 'SE/ARK-1',
    name: 'Arkivet',
    isPublished: false,
    createdAt: new Date('2026-01-01'),
    createdBy:1,
    updatedAt:new Date('2026-01-01'),
    updatedBy: 1,
    ...overrides,
});

const makeCreator = (overrides: Partial<ArchiveCreator> = {}): ArchiveCreator => ({
    id: 30,
    creatorType: 'corporate',
    name: 'Kommunen',
    isPublished: false,
    ...overrides,
});

// Smallest valid request!
const makeRequest = (overrides: Partial<CreateStructureRequest> = {}): CreateStructureRequest => ({
    createdBy: 7,
    archiveId: 20,
    structure: {
        code: 'KLA-1',
        name: 'Klassificering',
        structure_type: 'klassificering',

    },
    ...overrides,
});


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('StructureCreationService', () =>{
    let creators: { findById: jest.Mock; create: jest.Mock };
    let archives: { findById: jest.Mock; create: jest.Mock };
    let structures: {findByCode: jest.Mock; create: jest.Mock };
    let links: { create: jest.Mock };
    let trx: Knex.Transaction;
    let knex: Knex;
    let service: StructureCreationService;

    beforeEach(() => {
        jest.clearAllMocks();

        creators = { findById: jest.fn(), create: jest.fn() };
        archives = { findById: jest.fn(), create: jest.fn() };
        structures= { findByCode: jest.fn(), create: jest.fn() };
        links = { create: jest.fn() };

        jest.mocked(ArchiveCreatorRepository).mockImplementation(() => creators as unknown as ArchiveCreatorRepository);
        jest.mocked(ArchiveRepository).mockImplementation(() => archives as unknown as ArchiveRepository);
        jest.mocked(StructureRepository).mockImplementation(() => structures as unknown as StructureRepository);
        jest.mocked(ArchiveStructureRepository).mockImplementation(() => links as unknown as ArchiveStructureRepository);

        structures.findByCode.mockResolvedValue(undefined);
        structures.create.mockResolvedValue(makeStructure());
        archives.findById.mockResolvedValue(makeArchive());
        archives.create.mockResolvedValue(makeArchive({ id: 21 }));
        creators.create.mockResolvedValue(makeCreator({ id: 31 }));
        links.create.mockResolvedValue({ id: 1 });

        trx = { isTrx: true } as unknown as Knex.Transaction;
        knex = {
            transaction: jest.fn(async (cb: (t: Knex.Transaction) => Promise<unknown>) => cb(trx)),
        } as unknown as Knex;

        service = new StructureCreationService(knex);

    });



    describe('create - before the transaction', () => {

        /*
         Verifies that a code made of only spaces counts as missing: we get a ValidationError
         and the service stops before it even looks for duplicates or opens a transaction.
         */
        test('_TC045_create_rejectsBlankCode', async () => {
            const request =makeRequest({ structure: { code: '   ', name: 'Namn', structure_type: 'klassificering' } });

            await expect(service.create(request)).rejects.toThrow(ValidationError);
            await expect(service.create(request)).rejects.toThrow('Structure code is required.');
            expect(structures.findByCode).not.toHaveBeenCalled();
            expect(knex.transaction).not.toHaveBeenCalled();

        });


        /*
         Verifies that a code that is already taken gives a ConflictError and that no
         transaction is started, so nothing gets written.
         */
        test('_TC046_create_rejectsCodeThatAlreadyExists', async () => {
            structures.findByCode.mockResolvedValue(makeStructure());

            await expect(service.create(makeRequest())).rejects.toThrow(ConflictError);
            await expect(service.create(makeRequest())).rejects.toThrow("A structure with code 'KLA-1' already exists.");
            expect(knex.transaction).not.toHaveBeenCalled();
            expect(structures.create).not.toHaveBeenCalled();

        });

    });



    describe('create - existing archive', () => {

        /*
         Verifies the simple case: an archiveId is given, the archive is looked up and the
         new structure is linked to it. No archive or creator is created, so archiveCreator
         in the result is undefined. Also checks the defaults the structure gets when only
         code and name are sent (klassificering, unpublished, language 'swe', rest null).
         */
        test('_TC047_create_linksStructureToExistingArchive', async () => {
            const result = await service.create(makeRequest());

            expect(archives.findById).toHaveBeenCalledWith(20);
            expect(archives.create).not.toHaveBeenCalled();
            expect(creators.create).not.toHaveBeenCalled();

            expect(structures.create).toHaveBeenCalledWith(expect.objectContaining({
                code: 'KLA-1',
                structureType: 'klassificering',
                isPublished:false,
                languageCode: 'swe',
                description: null,
                createdBy: 7,
            }));

            expect(links.create).toHaveBeenCalledWith({
                archiveId: 20,
                structureId: 10,
                validFrom:null,
                validTo: null,
                createdBy: 7,
            });

            expect(result.archive.id).toBe(20);
            expect(result.structure.id).toBe(10);
            expect(result.archiveCreator).toBeUndefined();
        });


        /*
         Verifies that an archiveId that doesn't exist gives a NotFoundError and that no
         structure is created for it.
         */
        test('_TC048_create_throwsWhenArchiveNotFound', async () =>{
            archives.findById.mockResolvedValue(undefined);

            await expect(service.create(makeRequest({ archiveId: 999 }))).rejects.toThrow(NotFoundError);
            expect(structures.create).not.toHaveBeenCalled();
            expect(links.create).not.toHaveBeenCalled();
        });

    });




    describe('create - new archive', () => {

        /*
         Verifies the longest path: a new creator, a new archive and the structure in one go.
         The creator gets the fixed defaults (corporate, not published, no parent) and the
         optional fields fall back to null. The archive points at the new creator, the link
         row uses the new archive, and the new creator comes back in the result.
         */
        test('_TC049_create_makesNewCreatorAndNewArchive', async () =>{
            const request = makeRequest({
                archiveId: undefined,
                newArchiveCreator: { name: 'Ny bildare', startYear: 1990 },
                newArchive: { referenceCode: 'SE/NY', name: 'Nytt arkiv' },

            });

            const result = await service.create(request);
            expect(creators.create).toHaveBeenCalledWith({
                parentId: null,
                creatorType: 'corporate',
                name: 'Ny bildare',
                startYear: 1990,
                endYear:null,
                description:null,
                externalId:null,
                isPublished: false,
                createdAt: expect.any(Date),
                createdBy: 7,
                updatedAt:expect.any(Date),
                updatedBy: 7,
            });

            expect(archives.create).toHaveBeenCalledWith(
                expect.objectContaining({ archiveCreatorId: 31, referenceCode: 'SE/NY', name: 'Nytt arkiv' }),
            );
            expect(links.create).toHaveBeenCalledWith(expect.objectContaining({ archiveId: 21, structureId: 10 }));
            expect(result.archiveCreator?.id).toBe(31);
            expect(result.archive.id).toBe(21);

        });


        /*
         Verifies that a new archive can also use an archive creator that already exists:
         the creator is looked up, the archive gets its id and no new creator is made.
         The referenceCode is left out, so the archive gets null for it.
         */
        test('_TC053_create_makesNewArchiveWithExistingCreator', async () =>{
            creators.findById.mockResolvedValue(makeCreator());

            const request = makeRequest({
                archiveId: undefined,
                archiveCreatorId: 30,
                newArchive: { name: 'Nytt arkiv' } as unknown as CreateStructureRequest['newArchive'],

            });

            const result = await service.create(request);
            expect(creators.findById).toHaveBeenCalledWith(30);
            expect(creators.create).not.toHaveBeenCalled();
            expect(archives.create).toHaveBeenCalledWith(
                expect.objectContaining({ archiveCreatorId: 30, referenceCode: null, name: 'Nytt arkiv' }),
            );

            expect(result.archiveCreator).toBeUndefined();

        });


        /*
         Verifies that archiveCreatorId and newArchiveCreator can't both be sent,
         same rule as for the archive. Nothing is looked up or created.
         */
        test('_TC054_create_rejectsCreatorIdTogetherWithNewCreator', async () => {
            const request = makeRequest({
                archiveId: undefined,
                archiveCreatorId: 30,
                newArchiveCreator: { name: 'Ny bildare' },
                newArchive: { referenceCode: 'SE/NY', name: 'Nytt arkiv' },

            });

            await expect(service.create(request)).rejects.toThrow(
                'Provide either archiveCreatorId or newArchiveCreator, not both.',
            );
            expect(creators.findById).not.toHaveBeenCalled();
            expect(archives.create).not.toHaveBeenCalled();
        });


        /*
         Verifies that an archiveCreatorId that doesn't exist gives a NotFoundError,
         and the archive and structure are never created.
         */
        test('_TC055_create_throwsWhenCreatorNotFound', async () => {
            creators.findById.mockResolvedValue(undefined);

            const request = makeRequest({
                archiveId: undefined,
                archiveCreatorId: 999,
                newArchive: { referenceCode: 'SE/NY', name: 'Nytt arkiv' },
            });

            await expect(service.create(request)).rejects.toThrow(NotFoundError);
            await expect(service.create(request)).rejects.toThrow('Archive creator not found.');
            expect(archives.create).not.toHaveBeenCalled();
            expect(structures.create).not.toHaveBeenCalled();


        });


        /*
         Verifies that a new archive without any creator (no id and no new one) is rejected.
         */

        test('_TC056_create_rejectsNewArchiveWithoutCreator', async () => {
            const request = makeRequest({
                archiveId: undefined,
                newArchive: { referenceCode: 'SE/NY', name: 'Nytt arkiv' },
            });

            await expect(service.create(request)).rejects.toThrow(
                'A new archive requires an existing or a new archive creator.',
            );

            expect(creators.create).not.toHaveBeenCalled();
            expect(archives.create).not.toHaveBeenCalled();

        });


        /*
         Verifies that the optional fields of a new creator are saved when they are sent
         (endYear and description), and that a startYear that is left out becomes null.
         */
        test('_TC057_create_keepsOptionalCreatorFields', async() => {
            const request = makeRequest({
                archiveId: undefined,
                newArchiveCreator: { name: 'Ny bildare', endYear: 2020, description: 'Nedlagd' },
                newArchive: { referenceCode: 'SE/NY', name: 'Nytt arkiv' },
            });

            await service.create(request);

            expect(creators.create).toHaveBeenCalledWith(
                expect.objectContaining({ startYear: null, endYear: 2020, description: 'Nedlagd' }),
            );

        });

    });



    describe('create - other request checks', () =>{
        /*
         Verifies that a blank name is a ValidationError, same as the code,
         and nothing else happens.
         */

        test('_TC058_create_rejectsBlankName', async () => {
            const request =makeRequest({structure: { code: 'KLA-1',name: '  ', structure_type: 'klassificering' } });

            await expect(service.create(request)).rejects.toThrow('Structure name is required.');
            expect(structures.findByCode).not.toHaveBeenCalled();
            expect(knex.transaction).not.toHaveBeenCalled();

        });



        /*
         Verifies that sending both archiveId and newArchive is not allowed, the client
         has to pick one. The archive is not looked up and nothing is created.
         */
        test('_TC059_create_rejectsArchiveIdTogetherWithNewArchive', async () => {
            const request = makeRequest({ newArchive: {referenceCode: 'SE/NY', name: 'Nytt arkiv' }});

            await expect(service.create(request)).rejects.toThrow('Provide either archiveId or newArchive, not both.');

            expect(archives.findById).not.toHaveBeenCalled();
            expect(structures.create).not.toHaveBeenCalled();
        });


        /*
         Verifies that a request with neither archiveId nor newArchive is rejected,
         a structure always has to belong to an archive.
         */
        test('_TC060_create_rejectsRequestWithoutAnyArchive', async() => {
            const request = makeRequest({ archiveId: undefined });

            await expect(service.create(request)).rejects.toThrow('Provide archiveId or newArchive.');
            expect(structures.create).not.toHaveBeenCalled();

        });


        /*
         Verifies that a request where code and name are missing completely (not just blank)
         is handled the same way and doesn't crash on the trim.
         */
        test('_TC061_create_rejectsMissingCode', async () =>{
            const request = makeRequest({
                structure: { structure_type: 'klassificering' } as unknown as CreateStructureRequest['structure'],
            });

            await expect(service.create(request)).rejects.toThrow('Structure code is required.');
        });


        /*
         Verifies that the optional structure fields the client does send are saved as they
         are, and that the language from the request wins over the 'swe' default.
         */
        test('_TC062_create_keepsOptionalStructureFields', async () => {
            const validFrom = new Date('2026-01-01');
            const validTo = new Date('2030-12-31');
            const request =makeRequest({
                structure: {
                    code: 'KLA-2',
                    name: 'Med allt',
                    structure_type: 'klassificering',
                    description:'En beskrivning',
                    validFrom,
                    validTo,
                    agencyCode: 'SE2120000000',
                    agencyName: 'Myndigheten',
                    languageCode: 'eng',
                    license: 'CC0',
                    version: '2',
                    externalId: 'ext-1',

                },

            });

            await service.create(request);
            expect(structures.create).toHaveBeenCalledWith(expect.objectContaining({
                description: 'En beskrivning',
                validFrom,
                validTo,
                agencyCode: 'SE2120000000',
                agencyName: 'Myndigheten',
                languageCode: 'eng',
                license: 'CC0',
                version: '2',
                externalId: 'ext-1',
            }));
        });


    });


});
