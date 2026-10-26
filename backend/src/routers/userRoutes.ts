import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { UserService } from '../services/userService';
import { UserRepository } from '../repos/userRepository';
import { Knex } from 'knex';
import { RequestContext } from '../types/requestContext';

/* Builds the /users router and connects its list endpoint to a repository-backed service and a
"request-scoped" controller. The db connection is shared, but the controller context is created whit each request. */

export function createUserRouter(db: Knex): Router {
  const router = Router();

  const userRepository = new UserRepository(db, 'users');
  const userService = new UserService(userRepository);


  /* This creates a UserController per request for each GET request so the RequestContext sees the caller's session user,
  then asks it to return the user list. */

  router.get('/all', (req, res) => {
    const userController = new UserController(new RequestContext(req, db), userService);
    void userController.getAllUsers(req, res);
  });

  return router;
}
