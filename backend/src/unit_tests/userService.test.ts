/**
 Unit tests for UserService.
 The repository is passed in through the constructor, so it is mocked with jest.fn().
 Nothing here touches any db.
 Covers getAllUsers: limit and offset are passed on and the users come back as they are.


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import type { User } from '../models/user';
import type { UserRepository } from '../repos/userRepository';
import { UserService } from '../services/userService';


// setup for the tests

const makeUser = (overrides: Partial<User> = {}): User =>({
    id:1,
    adObjectId:'oid-123',
    username: 'anna',
    displayName: 'Anna Andersson',
    email: 'anna@example.com',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,

});


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('UserService', () => {
    let users: jest.Mocked<UserRepository>;
    let service: UserService;

    beforeEach(() =>{
        users = { findAll: jest.fn() } as unknown as jest.Mocked<UserRepository>;
        service = new UserService(users);

    });



    describe('getAllUsers', () =>{

        /*
         Verifies that limit and offset go straight to the repository and the list it
         gives back is returned as it is, nothing filtered or changed.
         */
        test('_TC073_getAllUsers_returnsUsersFromRepository', async () => {
            const list = [makeUser(), makeUser({ id: 2, adObjectId: 'oid-456',username: 'bo' })];
            users.findAll.mockResolvedValue(list);

            const result = await service.getAllUsers(100, 20);
            expect(users.findAll).toHaveBeenCalledWith(100, 20);
            expect(result).toEqual(list);

        });


    });

});
