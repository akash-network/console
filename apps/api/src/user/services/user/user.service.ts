import assert from "http-assert";
import randomInt from "lodash/random";
import { singleton } from "tsyringe";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { type UserOutput, UserRepository } from "../../repositories/user/user.repository";

@singleton()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly analyticsService: AnalyticsService,
    private readonly logger: LoggerService,
    private readonly notificationService: NotificationService,
    private readonly auth0: Auth0Service
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
    const userDetails = {
      userId: data.userId,
      email: data.email,
      emailVerified: data.emailVerified,
      subscribedToNewsletter: data.subscribedToNewsletter,
      lastIp: data.ip,
      lastUserAgent: data.userAgent,
      lastFingerprint: data.fingerprint
    };

    const user = await this.upsertUser({
      ...userDetails,
      username: data.wantedUsername
    });

    this.logger.info({ event: "USER_REGISTERED", id: user.id, userId: user.userId });
    this.analyticsService.track(user.id, "user_registered", {
      username: user.username,
      email: user.email
    });

    const result = await this.notificationService.createDefaultChannel(user).catch(error => ({ error }));

    if (result?.error) {
      this.logger.error({ event: "FAILED_TO_CREATE_DEFAULT_NOTIFICATION_CHANNEL", id: user.id, error: result.error });
    }

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
      return await this.userRepository.upsertByUserId(userDetails);
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

  async syncEmailVerified({ email }: { email: string }): Promise<UserOutput> {
    const auth0User = await this.auth0.getUserByEmail(email);
    assert(auth0User, 404);

    const user = await this.userRepository.updateBy(
      {
        email
      },
      {
        emailVerified: auth0User.email_verified
      },
      {
        returning: true
      }
    );

    assert(user, 404);

    return user;
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
  userId: string;
  wantedUsername: string;
  email: string;
  emailVerified: boolean;
  subscribedToNewsletter: boolean;
  ip: string;
  userAgent: string;
  fingerprint: string;
}
