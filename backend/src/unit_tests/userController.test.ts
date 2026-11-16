/**
 Unit tests for UserController (GET of all users).
 UserService is mocked with jest.fn() and req/res are small fake objects, so no
 express server and no db is needed. The logger is mocked too, otherwise importing
 BaseController would start pino and write to logs/server.log.
 Covers the normal answer: the users come back in the standard { success, data } shape.


 Test Naming Convention: _TCnnn_<function>_<description> (for verification-doc match!)

 IMPORTANT : test IDs are permanent!!
  - never renumber, reuse or swap an existing TC id, not even to "tidy up" the order.
    The id links the test to the verification doc and to every old test report.
  - a new test always gets the next free number across ALL files in src/unit_tests
    (check the highest TC id first), no matter where in the file it is placed.
  - if a test is removed, its id is retired and not given to another test.
  - renaming the description part is ok, the TCnnn part stays.
 */


import type { Request, Response } from 'express';
import type { User } from '../models/user';
import type { UserService } from '../services/userService';
import { UserController } from '../controllers/userController';


jest.mock('../config/logger', () =>({
    __esModule: true,
    default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));


// setup for the tests

const makeUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    adObjectId: 'oid-123',
    username: 'anna',
    displayName: 'Anna Andersson' ,
    email: 'anna@example.com',
    isActive:true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,

});

// fake express response, status() returns itself so res.status(…).json(…) works!
const makeRes = () => {
    const res ={ status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
};


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('UserController', () =>{
    let userService: jest.Mocked<UserService>;
    let controller: UserController;


    beforeEach(() =>{
        userService = { getAllUsers: jest.fn() } as unknown as jest.Mocked<UserService>;
        controller = new UserController(userService);

    });



    describe('getAllUsers', () => {

        /*
         Verifies the normal case: the controller asks the service for the first 100 users
         (limit 100, offset 0, fixed for now) and answers with { success: true, data }.
         No status is set, so express uses the default 200.
         */

        test('_TC074_getAllUsers_answersWithUsers', async () =>{

            const list = [makeUser(), makeUser({id: 2, username: 'bo'})];
            userService.getAllUsers.mockResolvedValue(list);
            const res = makeRes();

            await controller.getAllUsers({} as Request, res as unknown as Response);

            expect(userService.getAllUsers).toHaveBeenCalledWith(100, 0);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ success: true, data: list, message: undefined });
        });


    });

});
