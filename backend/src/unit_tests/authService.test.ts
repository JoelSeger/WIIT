/**
 Unit tests for AuthService (the shared part of dev login and real SSO).
 Both repositories are passed in through the constructor, so they are mocked with
 jest.fn(). Nothing here touches any db.
 Covers the normal login: the user is found/created and gets the roles of their AD groups.


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
import type { AdGroupRoleRepository } from '../repos/adGroupRoleRepository';
import type { UserRepository } from '../repos/userRepository';
import { AuthService, type LoginIdentity } from '../services/authService';


// setup for the tests

const makeUser = (overrides: Partial<User> = {}): User => ({
    id: 1,
    adObjectId: 'oid-123',
    username: 'anna',
    displayName: 'Anna Andersson',
    email: 'anna@example.com',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
});

const makeIdentity =(overrides: Partial<LoginIdentity> = {}): LoginIdentity => ({

    adObjectId: 'oid-123',
    username: 'anna',
    displayName: 'Anna Andersson',

    email: 'anna@example.com',
    groups: ['grp-editors'],
    ...overrides,

});


// ──────────────────────────────────────
// The Tests
// ──────────────────────────────────────

describe('AuthService', () =>{
    let users: jest.Mocked<UserRepository>;
    let groupRoles: jest.Mocked<AdGroupRoleRepository>;
    let service: AuthService;

    beforeEach(() =>{
        users = { upsertOnLogin: jest.fn() } as unknown as jest.Mocked<UserRepository>;
        groupRoles = { rolesForGroups: jest.fn() } as unknown as jest.Mocked<AdGroupRoleRepository>;

        service = new AuthService(users, groupRoles);
    });



    describe('login', ()=>{

        /*
         Verifies the normal login: the identity is passed on to upsertOnLogin, the roles
         are looked up from the AD groups of the identity, and the session user that comes
         back is the user row plus those roles.
         */

        test('_TC070_login_returnsUserWithRolesFromGroups', async() => {
            const identity = makeIdentity({ groups:['grp-editors', 'grp-viewers']});
            users.upsertOnLogin.mockResolvedValue(makeUser());
            groupRoles.rolesForGroups.mockResolvedValue(['editor','viewer']);

            const sessionUser = await service.login(identity);
            expect(users.upsertOnLogin).toHaveBeenCalledWith(identity);
            expect(groupRoles.rolesForGroups).toHaveBeenCalledWith(['grp-editors', 'grp-viewers']);
            expect(sessionUser).toEqual({ ...makeUser(), roles:['editor', 'viewer']});

        });


    });

});
