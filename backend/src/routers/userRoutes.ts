import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { UserService } from '../services/userService';
import { UserRepository } from '../repos/userRepository';
import type { Knex } from 'knex';
import { UnitOfWork } from '../config/db';

export function createUserRouter(db: Knex): Router {
  const router = Router();
  const controller = new UserController(new UserService(new UnitOfWork(db)));

  router.get('/all', controller.getAllUsers);

  return router;
}
