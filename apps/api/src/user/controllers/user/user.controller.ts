import { singleton } from "tsyringe";

import { NotFoundException } from "@src/core/exceptions/not-found.exception";
import { UserRepository } from "@src/user/repositories";
import { GetUserParams } from "@src/user/routes/get-anonymous-user/get-anonymous-user.router";
import { AnonymousUserOutput } from "@src/user/routes/schemas/user.schema";

@singleton()
export class UserController {
  constructor(private readonly userRepository: UserRepository) {}

  async create(): Promise<AnonymousUserOutput> {
    return await this.userRepository.create();
  }

  async getById({ id }: GetUserParams): Promise<AnonymousUserOutput> {
    const user = await this.userRepository.findAnonymousById(id);

    NotFoundException.assert(user);

    return user;
  }
}
