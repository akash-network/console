import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { ExponentialBackoff, handleAll, retry, type RetryPolicy } from "cockatiel";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, NotificationsInternalApiClient, NotificationsInternalOperationDefs } from "../../providers/notifications-api.provider";
import { NOTIFICATIONS_API_CLIENT, NOTIFICATIONS_INTERNAL_API_CLIENT } from "../../providers/notifications-api.provider";

@singleton()
export class NotificationService {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #retryPolicy: RetryPolicy;

  constructor(
    @inject(NOTIFICATIONS_API_CLIENT) private readonly notificationsApi: NotificationsApiClient,
    @inject(NOTIFICATIONS_INTERNAL_API_CLIENT) private readonly notificationsInternalApi: NotificationsInternalApiClient,
    private readonly userRepository: UserRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: "NotificationService" });
    this.#retryPolicy = retry(handleAll, {
      maxAttempts: 4,
      backoff: new ExponentialBackoff({
        maxDelay: 5_000,
        initialDelay: 500
      })
    });
  }

  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { user, ...notification } = input;
    let defaultChannelCreated = false;
    await this.#retryPolicy.execute(async () => {
      try {
        await this.notificationsInternalApi.v1.createNotification(notification, { headers: { "x-user-id": user.id } });
      } catch (error) {
        if (!defaultChannelCreated && extractApiErrorCode(error) === "NOTIFICATION_CHANNEL_NOT_FOUND" && user.email) {
          await this.createDefaultChannel(user);
          defaultChannelCreated = true;
        }
        throw new Error("Failed to create notification", { cause: error });
      }
    });
  }

  async createDefaultChannel(user: UserInput): Promise<void> {
    await this.#retryPolicy.execute(async () => {
      try {
        await this.notificationsApi.v1.createDefaultNotificationChannel(
          { data: { name: "Default", type: "email", config: { addresses: [user.email!] } } },
          { headers: { "x-user-id": user.id } }
        );
      } catch (error) {
        throw new Error("Failed to create default notification channel", { cause: error });
      }
    });
  }

  async autoEnableDeploymentAlert(input: AutoEnableDeploymentAlertInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user?.email) {
      this.#logger.debug({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No user email", userId: input.userId });
      return;
    }

    const channelId = await this.getOrCreateNotificationChannelId(input.userId, user.email);
    if (!channelId) {
      this.#logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No channel found after creation", userId: input.userId });
      return;
    }

    await this.upsertDeploymentClosedAlert({
      userId: input.userId,
      walletAddress: input.walletAddress,
      dseq: input.dseq,
      channelId
    });
  }

  private async getOrCreateNotificationChannelId(userId: string, email: string): Promise<string | undefined> {
    let channels = await this.getNotificationChannels(userId);

    if (!channels?.data?.length) {
      // Treat the create as best-effort: a concurrent autoEnableDeploymentAlert for the
      // same user may have already won the race, so swallow the create error and let the
      // re-fetch decide whether a channel is now available.
      await this.createDefaultChannel({ id: userId, email }).catch(error => {
        this.#logger.debug({ event: "AUTO_ENABLE_ALERT_CHANNEL_CREATE_FAILED", userId, error });
      });
      channels = await this.getNotificationChannels(userId);
    }

    return channels?.data?.[0]?.id;
  }

  private async getNotificationChannels(userId: string) {
    return this.#retryPolicy.execute(async () => {
      return this.notificationsApi.v1.listNotificationChannels({ page: 1, limit: 1 }, { headers: { "x-user-id": userId } });
    });
  }

  private async upsertDeploymentClosedAlert(input: { userId: string; walletAddress: string; dseq: string; channelId: string }) {
    await this.#retryPolicy.execute(async () =>
      this.notificationsApi.v1.upsertDeploymentAlert(
        {
          dseq: input.dseq,
          data: {
            alerts: {
              deploymentClosed: { notificationChannelId: input.channelId, enabled: true }
            }
          }
        },
        { headers: { "x-owner-address": input.walletAddress, "x-user-id": input.userId } }
      )
    );
  }
}

interface UserInput {
  id: string;
  email?: string | null;
}

export interface AutoEnableDeploymentAlertInput {
  userId: string;
  walletAddress: string;
  dseq: string;
}

export type CreateNotificationInput = NotificationsInternalOperationDefs["createNotification"]["requestBody"]["content"]["application/json"] & {
  user: UserInput;
};
