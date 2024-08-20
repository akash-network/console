import pick from "lodash/pick";
import { Transaction } from "sequelize";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { LoggerService } from "@src/core";
import { checkUsernameAvailable } from "@src/services/db/userDataService";
import { UserOutput, UserRepository } from "@src/user/repositories";

export type UserInitInput = {
  anonymousUserId?: string;
  userId: string;
  wantedUsername: string;
  email: string;
  emailVerified: boolean;
  subscribedToNewsletter: boolean;
};

@singleton()
export class UserInitService {
  private readonly logger = new LoggerService({ context: UserInitService.name });
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  async registerOrGetUser(input: UserInitInput) {
    let user = await this.tryToRegisterAnonymousUser(input);

    if (!user) {
      user = await this.tryToRetrieveUser(input);
    }

    if (user && input.anonymousUserId) {
      await this.tryToTransferWallet(input.anonymousUserId, user.id);
    } else {
      user = await this.tryToRegisterUser(input);
    }

    user = await this.tryToUpdateUser(input, user);

    return pick(user, [
      "id",
      "userId",
      "username",
      "email",
      "emailVerified",
      "stripeCustomerId",
      "bio",
      "subscribedToNewsletter",
      "youtubeUsername",
      "twitterUsername",
      "githubUsername"
    ]);
  }

  private async tryToRegisterAnonymousUser(input: UserInitInput): Promise<UserOutput | undefined> {
    if (!input.anonymousUserId) {
      return;
    }
    try {
      const user = await this.userRepository.updateBy(
        { id: input.anonymousUserId, userId: null },
        {
          userId: input.userId,
          username: await this.generateUsername(input.wantedUsername),
          email: input.email,
          emailVerified: input.emailVerified,
          stripeCustomerId: null,
          subscribedToNewsletter: input.subscribedToNewsletter
        }
      );

      if (user) {
        this.logger.info({ event: "ANONYMOUS_USER_REGISTERED", id: input.anonymousUserId, userId: input.userId });
      }

      return user;
    } catch (error) {
      if (error.name !== "SequelizeUniqueConstraintError") {
        throw error;
      }

      this.logger.info({ event: "ANONYMOUS_USER_ALREADY_REGISTERED", id: input.anonymousUserId, userId: input.userId });
    }
  }

  private async tryToRetrieveUser(input: UserInitInput): Promise<UserOutput | undefined> {
    const user = await this.userRepository.findOneBy({ userId: input.userId });

    if (user) {
      this.logger.debug({ event: "USER_RETRIEVED", userId: input.userId });
    }

    if (user && input.anonymousUserId) {
      await this.tryToTransferWallet(input.anonymousUserId, user.id);
    }

    return user;
  }

  private async tryToRegisterUser(input: UserInitInput): Promise<UserOutput> {
    const user = await this.userRepository.create({
      userId: input.userId,
      username: await this.generateUsername(input.wantedUsername),
      email: input.email,
      emailVerified: input.emailVerified,
      subscribedToNewsletter: input.subscribedToNewsletter
    });

    this.logger.info({ event: "USER_REGISTERED", userId: input.userId, id: user.id });

    return user;
  }

  private async tryToUpdateUser(input: UserInitInput, user?: UserOutput) {
    if (!user) {
      return;
    }

    if (user.email !== input.email || user.emailVerified !== input.emailVerified) {
      const updatePayload = {
        email: input.email,
        emailVerified: input.emailVerified
      };
      await this.userRepository.updateBy({ userId: input.userId }, updatePayload);

      return {
        ...user,
        ...updatePayload
      };
    }

    return user;
  }

  private async tryToTransferWallet(prevUserId: string, nextUserId: string) {
    if (process.env.BILLING_ENABLED !== "true") {
      return;
    }

    try {
      await this.userWalletRepository.updateBy({ userId: prevUserId }, { userId: nextUserId });
    } catch (error) {
      if (!error.message.includes("user_wallets_user_id_unique")) {
        throw error;
      }
    }
  }

  private async generateUsername(wantedUsername: string, dbTransaction?: Transaction): Promise<string> {
    let baseUsername = wantedUsername.replace(/[^a-zA-Z0-9_-]/gi, "");

    if (baseUsername.length < 3) {
      baseUsername = "anonymous";
    } else if (baseUsername.length > 40) {
      baseUsername = baseUsername.substring(0, 40);
    }

    let username = baseUsername;

    while (!(await checkUsernameAvailable(username, dbTransaction))) {
      username = baseUsername + this.randomIntFromInterval(1000, 9999);
    }

    return username;
  }

  private randomIntFromInterval(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
}
