import { User } from "../models/user";
import { UserService } from "../services/userService";
import { BaseController } from "./baseController";
import { Request, Response } from "express";

export class UserController extends BaseController {
  constructor(private readonly userService: UserService) {
    super();
  }

  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userService.getAllUsers(100, 0);

      if (!users) {
        this.error(res, "Users not found", 500)
        return;
      }

      this.success<User[]>(res, users)
    } catch (error: any) {
      this.error(res, error.message, 404)
    }
  }
}
