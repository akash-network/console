import randomInt from "lodash/random";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { LoggerService } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { UserOutput, UserRepository } from "../../repositories/user/user.repository";

@singleton()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly analyticsService: AnalyticsService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly logger: LoggerService
  ) {}

  async registerUser(data: RegisterUserInput): Promise<{
    id: string;
    userId: string;
    username: string;
    email: string;
    emailVerified: boolean;
    stripeCustomerId: string | null;
    bio: string | null;
    subscribedToNewsletter: boolean;
    youtubeUsername: string | null;
    twitterUsername: string | null;
    githubUsername: string | null;
  }> {
    let isAnonymous = false;
    const userDetails = {
      userId: data.userId,
      email: data.email,
      emailVerified: data.emailVerified,
      subscribedToNewsletter: data.subscribedToNewsletter,
      lastIp: data.ip,
      lastUserAgent: data.userAgent,
      lastFingerprint: data.fingerprint
    };

    if (data.anonymousUserId) {
      const user = await this.userRepository.updateBy(
        {
          id: data.anonymousUserId,
          userId: null
        },
        userDetails,
        { returning: true }
      );

      isAnonymous = !!user;
    }

    const user = await this.upsertUser({
      ...userDetails,
      username: data.wantedUsername
    });

    if (!isAnonymous && data.anonymousUserId && user.id !== data.anonymousUserId) {
      await this.tryToTransferWallet(data.anonymousUserId, user.id);
    }

    const event = isAnonymous ? "ANONYMOUS_USER_REGISTERED" : "USER_REGISTERED";
    this.logger.info({ event, id: user.id, userId: user.userId });
    this.analyticsService.track(user.id, "user_registered");

    const { id, userId, username, email, emailVerified, stripeCustomerId, bio, subscribedToNewsletter, youtubeUsername, twitterUsername, githubUsername } =
      user;

    return {
      id,
      userId,
      username,
      email,
      emailVerified,
      stripeCustomerId,
      bio,
      subscribedToNewsletter,
      youtubeUsername,
      twitterUsername,
      githubUsername
    } as Awaited<ReturnType<this["registerUser"]>>;
  }

  private async upsertUser(userDetails: UpdateUserInput, attempt = 0): Promise<UserOutput> {
    try {
      return await this.userRepository.upsert(userDetails);
    } catch (error) {
      if (userDetails.username && isUniqueViolation(error) && error.constraint_name?.includes("username") && attempt < 10) {
        return this.upsertUser(
          {
            ...userDetails,
            username: adjustUsername(userDetails.username)
          },
          attempt + 1
        );
      }

      throw error;
    }
  }

  private async tryToTransferWallet(prevUserId: string, nextUserId: string) {
    try {
      await this.userWalletRepository.updateBy({ userId: prevUserId }, { userId: nextUserId });
    } catch (error) {
      if (!isUniqueViolation(error) || error.constraint_name !== "user_wallets_user_id_unique") {
        throw error;
      }
    }
  }
}

function adjustUsername(wantedUsername: string) {
  let baseUsername = wantedUsername.replace(/[^\w-]+/g, "");

  if (baseUsername.length < 3) {
    baseUsername = baseUsername.padEnd(10, "anonymous");
  } else if (baseUsername.length > 40) {
    baseUsername = baseUsername.slice(0, 40);
  }

  return baseUsername + randomInt(1000, 9999).toString();
}

type UpdateUserInput = Partial<{
  userId: string;
  username: string;
  email: string;
  emailVerified: boolean;
  subscribedToNewsletter: boolean;
  lastIp: string;
  lastUserAgent: string;
  lastFingerprint: string;
}>;

export interface RegisterUserInput {
  anonymousUserId?: string;
  userId: string;
  wantedUsername: string;
  email: string;
  emailVerified: boolean;
  subscribedToNewsletter: boolean;
  ip: string;
  userAgent: string;
  fingerprint: string;
}
