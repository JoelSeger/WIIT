import { UnitOfWork } from "../config/db";
import { User } from "../models/user";
import { UserRepository } from "../repos/userRepository";

export class UserService {

  constructor(private readonly uow: UnitOfWork) { }

  async getAllUsers(limit: number, offset: number): Promise<User[]> {
    const users = await this.uow.repos.user.findAll(limit, offset);
    return users;
  }

}
