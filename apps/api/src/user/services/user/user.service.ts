import assert from "http-assert";
import randomInt from "lodash/random";
import { singleton } from "tsyringe";
import * as uuid from "uuid";

import { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import {
  addTemplateFavorite as addTemplateFavoriteDb,
  deleteTemplate as deleteTemplateDb,
  getFavoriteTemplates as getFavoriteTemplatesDb,
  getTemplateById as getTemplateByIdDb,
  getTemplates as getTemplatesDb,
  removeTemplateFavorite as removeTemplateFavoriteDb,
  saveTemplate as saveTemplateDb,
  saveTemplateDesc as saveTemplateDescDb
} from "@src/services/db/templateService";
import {
  checkUsernameAvailable as checkUsernameAvailableDb,
  getUserByUsername as getUserByUsernameDb,
  subscribeToNewsletter as subscribeToNewsletterDb,
  updateSettings as updateSettingsDb
} from "@src/services/db/userDataService";
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
    this.analyticsService.identify(user.id, {
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

  async getUserByUsername(username: string) {
    return await getUserByUsernameDb(username);
  }

  async updateSettings(
    userId: string,
    username: string,
    subscribedToNewsletter: boolean,
    bio: string,
    youtubeUsername: string,
    twitterUsername: string,
    githubUsername: string
  ) {
    if (!/^[a-zA-Z0-9_-]*$/.test(username)) {
      throw new Error("Username can only contain letters, numbers, dashes and underscores");
    }
    await updateSettingsDb(userId, username, subscribedToNewsletter, bio, youtubeUsername, twitterUsername, githubUsername);
  }

  async getTemplateById(templateId: string, userId: string = "") {
    if (!uuid.validate(templateId)) {
      throw new Error("Invalid template id");
    }
    return await getTemplateByIdDb(templateId, userId);
  }

  async saveTemplate(
    id: string,
    userId: string,
    sdl: string,
    title: string,
    cpu: number,
    ram: number,
    storage: number,
    isPublic: boolean
  ) {
    if (!sdl) {
      throw new Error("Sdl is required");
    }
    if (!title) {
      throw new Error("Title is required");
    }
    return await saveTemplateDb(id, userId, sdl, title, cpu, ram, storage, isPublic);
  }

  async saveTemplateDesc(id: string, userId: string, description: string) {
    await saveTemplateDescDb(id, userId, description);
  }

  async getTemplates(username: string, userId: string = "") {
    return await getTemplatesDb(username, userId);
  }

  async deleteTemplate(userId: string, templateId: string) {
    if (!templateId) {
      throw new Error("Template id is required");
    }
    if (!uuid.validate(templateId)) {
      throw new Error("Invalid template id");
    }
    await deleteTemplateDb(userId, templateId);
  }

  async checkUsernameAvailable(username: string) {
    return await checkUsernameAvailableDb(username);
  }

  async getFavoriteTemplates(userId: string) {
    return await getFavoriteTemplatesDb(userId);
  }

  async addFavoriteTemplate(userId: string, templateId: string) {
    if (!templateId) {
      throw new Error("Template id is required");
    }
    await addTemplateFavoriteDb(userId, templateId);
  }

  async removeFavoriteTemplate(userId: string, templateId: string) {
    if (!templateId) {
      throw new Error("Template id is required");
    }
    await removeTemplateFavoriteDb(userId, templateId);
  }

  async subscribeToNewsletter(userId: string) {
    await subscribeToNewsletterDb(userId);
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
