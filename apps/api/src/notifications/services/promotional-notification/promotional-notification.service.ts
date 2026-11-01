import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { type CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { createProductUpdateUnsubscribeToken } from "@src/user/lib/product-update-unsubscribe-token/product-update-unsubscribe-token";
import { USER_CONFIG, type UserConfig } from "@src/user/providers/config.provider";
import type { UserOutput } from "@src/user/repositories";

export type PromotionalNotificationOutcome = "sent" | "unsubscribed" | "no_email" | "unsubscribe_unavailable";

@singleton()
export class PromotionalNotificationService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly notificationService: NotificationService,
    @inject(USER_CONFIG) private readonly userConfig: UserConfig,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly coreConfig: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: PromotionalNotificationService.name });
  }

  /** Goes to the account's own address alone, since that is the one that subscribed, never to the other addresses on its alert channel. */
  async send(user: UserOutput, notification: CreateNotificationInput): Promise<PromotionalNotificationOutcome> {
    if (user.productUpdatesUnsubscribedAt) return "unsubscribed";
    if (!user.email) return "no_email";

    const secret = this.userConfig.EMAIL_UNSUBSCRIBE_SECRET;
    if (!secret) {
      this.#logger.warn({ event: "PROMOTIONAL_EMAIL_UNSUBSCRIBE_UNAVAILABLE", userId: user.id, notificationId: notification.notificationId });
      return "unsubscribe_unavailable";
    }

    const token = encodeURIComponent(createProductUpdateUnsubscribeToken(secret, user.id));
    await this.notificationService.createNotification({
      ...notification,
      unsubscribe: {
        url: `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/unsubscribe?token=${token}`,
        oneClickUrl: `${this.coreConfig.get("SERVER_ORIGIN")}/v1/product-update-unsubscriptions?token=${token}`
      }
    });

    return "sent";
  }
}
