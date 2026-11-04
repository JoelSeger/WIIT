import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { UserService } from '../services/userService';
import { UserRepository } from '../repos/userRepository';
import { Knex } from 'knex';

export function createUserRouter(db: Knex): Router {
  const router = Router();

  const userRepository = new UserRepository(db, 'users');
  const userService = new UserService(userRepository);

  const userController = new UserController(userService);

  router.get('/all', (req, res, next) => {
    void userController.getAllUsers(req, res).catch(next);
  });

  return router;
}
