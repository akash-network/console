import assert from "http-assert";
import randomInt from "lodash/random";
import { inject, singleton } from "tsyringe";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { EmailVerificationCodeService } from "@src/auth/services/email-verification-code/email-verification-code.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { getPostgresError, isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { CUSTOMER_PROVISIONER, type CustomerProvisioner } from "@src/user/services/customer-provisioner/customer-provisioner";
import { UserInput, type UserOutput, UserRepository } from "../../repositories/user/user.repository";

@singleton()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly analyticsService: AnalyticsService,
    private readonly logger: LoggerService,
    private readonly notificationService: NotificationService,
    private readonly auth0: Auth0Service,
    private readonly emailVerificationCodeService: EmailVerificationCodeService,
    @inject(CUSTOMER_PROVISIONER) private readonly customerProvisioner: CustomerProvisioner
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

    const { user, wasInserted } = await this.upsertUser({
      ...userDetails,
      username: data.wantedUsername
    });

    this.logger.info({ event: "USER_REGISTERED", id: user.id, userId: user.userId });
    this.analyticsService.identify(user.id, {
      username: user.username,
      email: user.email
    });

    if (wasInserted) {
      this.analyticsService.track(user.id, "account_created", { category: "user" });
      // Provision a billing customer up front so billing actions (e.g. coupon redemption) never
      // fail on a brand-new account. Fire-and-forget best-effort: registration must not block on
      // (or fail because of) a slow/unavailable Stripe — the billing layer lazily ensures the
      // customer on the next billing action as a fallback.
      void this.customerProvisioner.provisionCustomer(user).catch(error => {
        this.logger.error({ event: "FAILED_TO_PROVISION_CUSTOMER", id: user.id, error });
      });
    }

    const result = await this.notificationService.createDefaultChannel(user).catch(error => ({ error }));

    if (result?.error) {
      this.logger.error({ event: "FAILED_TO_CREATE_DEFAULT_NOTIFICATION_CHANNEL", id: user.id, error: result.error });
    }

    if (!data.emailVerified && user.email) {
      await this.emailVerificationCodeService.sendCode(user.id).catch(error => {
        this.logger.error({ event: "FAILED_TO_SEND_INITIAL_VERIFICATION_CODE", id: user.id, error });
      });
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

  private async upsertUser(userDetails: UpdateUserInput, attempt = 0): Promise<{ user: UserOutput; wasInserted: boolean }> {
    try {
      return await this.userRepository.upsertOnExternalIdConflict(userDetails);
    } catch (error) {
      if (userDetails.username && isUniqueViolation(error) && getPostgresError(error)?.constraint_name?.includes("username") && attempt < 10) {
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

  async getUserByUsername(username: string): Promise<Pick<UserOutput, "username" | "bio"> | null> {
    const user = await this.userRepository.findOneBy({ username: username });

    if (!user) return null;

    return {
      username: user.username,
      bio: user.bio
    };
  }

  async updateUserDetails(
    userId: string,
    data: Pick<UserInput, "username" | "subscribedToNewsletter" | "bio" | "youtubeUsername" | "twitterUsername" | "githubUsername">
  ): Promise<void> {
    const user = await this.userRepository.findById(userId);
    assert(user, 404, "User settings not found: " + userId);

    const changes: Partial<UserInput> = {
      ...data
    };

    if (data.username && user.username !== data.username) {
      const existingUser = await this.userRepository.findOneBy({ username: data.username });
      assert(!existingUser, 422, `Username not available: ${data.username} (${userId})`);
      changes.username = data.username;
    }

    await this.userRepository.updateById(userId, changes);
  }

  async subscribeToNewsletter(userId: string) {
    await this.userRepository.updateById(userId, { subscribedToNewsletter: true });
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
