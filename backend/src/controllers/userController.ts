import { UserService } from "../services/userService";
import { BaseController } from "./baseController";
import { Request, Response } from "express";
import type { RequestContext } from '../types/requestContext';

export class UserController extends BaseController {

  /* this supplies the current request context to BaseController and retains the user service that performs the user lookups. */
  constructor(context: RequestContext, private readonly userService: UserService) {
    super(context);
  }

  /* Requests the first 100 users from UserService and returns them as JSON. A missing result or thrown service error is converted to an HTTP error response. */
  getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await this.userService.getAllUsers(100, 0);

      if (!users) {
        res.status(500).json({ error: "Users not found" })
        return;
      }

      res.status(200).json(users);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
}
