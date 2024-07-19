import { singleton } from "tsyringe";

import { NotFoundException } from "@src/core/exceptions/not-found.exception";
import { UserRepository } from "@src/user/repositories";
import { GetUserParams } from "@src/user/routes/get-anonymous-user/get-anonymous-user.router";
import { AnonymousUserResponseOutput } from "@src/user/routes/schemas/user.schema";

@singleton()
export class UserController {
  constructor(private readonly userRepository: UserRepository) {}

  async create(): Promise<AnonymousUserResponseOutput> {
    return {
      data: await this.userRepository.create()
    };
  }

  async getById({ id }: GetUserParams): Promise<AnonymousUserResponseOutput> {
    const user = await this.userRepository.findAnonymousById(id);

    NotFoundException.assert(user);

    return { data: user };
  }
}
