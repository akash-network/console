import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { backOff, type BackoffOptions } from "exponential-backoff";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, NotificationsInternalApiClient, NotificationsInternalOperationDefs } from "../../providers/notifications-api.provider";
import { NOTIFICATIONS_API_CLIENT, NOTIFICATIONS_INTERNAL_API_CLIENT } from "../../providers/notifications-api.provider";

const DEPLOYMENT_BALANCE_ALERT_THRESHOLD_RATIO = 0.3;

const DEFAULT_BACKOFF_OPTIONS: BackoffOptions = {
  maxDelay: 5_000,
  startingDelay: 500,
  timeMultiple: 2,
  numOfAttempts: 5
};

@singleton()
export class NotificationService {
  constructor(
    @inject(NOTIFICATIONS_API_CLIENT) private readonly notificationsApi: NotificationsApiClient,
    @inject(NOTIFICATIONS_INTERNAL_API_CLIENT) private readonly notificationsInternalApi: NotificationsInternalApiClient,
    private readonly userRepository: UserRepository,
    private readonly logger: LoggerService
  ) {}

  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { user, ...notification } = input;
    let defaultChannelCreated = false;
    await backOff(async () => {
      try {
        await this.notificationsInternalApi.v1.createNotification(notification, { headers: { "x-user-id": user.id } });
      } catch (error) {
        if (!defaultChannelCreated && extractApiErrorCode(error) === "NOTIFICATION_CHANNEL_NOT_FOUND" && user.email) {
          await this.createDefaultChannel(user);
          defaultChannelCreated = true;
        }
        throw new Error("Failed to create notification", { cause: error });
      }
    }, DEFAULT_BACKOFF_OPTIONS);
  }

  async createDefaultChannel(user: UserInput): Promise<void> {
    await backOff(async () => {
      try {
        await this.notificationsApi.v1.createDefaultChannel(
          { data: { name: "Default", type: "email", config: { addresses: [user.email!] } } },
          { headers: { "x-user-id": user.id } }
        );
      } catch (error) {
        throw new Error("Failed to create default notification channel", { cause: error });
      }
    }, DEFAULT_BACKOFF_OPTIONS);
  }

  async autoEnableDeploymentAlert(input: AutoEnableDeploymentAlertInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user?.email) {
      this.logger.debug({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No user email", userId: input.userId });
      return;
    }

    const channelId = await this.getOrCreateNotificationChannelId(input.userId, user.email);
    if (!channelId) {
      this.logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No channel found after creation", userId: input.userId });
      return;
    }

    const threshold = this.calculateAlertThreshold(input.escrowBalance);
    if (!threshold) return;

    await this.upsertDeploymentBalanceAlert({
      userId: input.userId,
      walletAddress: input.walletAddress,
      dseq: input.dseq,
      channelId,
      threshold
    });
  }

  private async getOrCreateNotificationChannelId(userId: string, email: string): Promise<string | undefined> {
    let channels = await this.getNotificationChannels(userId);

    if (!channels?.data?.length) {
      // Treat the create as best-effort: a concurrent autoEnableDeploymentAlert for the
      // same user may have already won the race, so swallow the create error and let the
      // re-fetch decide whether a channel is now available.
      await this.createDefaultChannel({ id: userId, email }).catch(error => {
        this.logger.debug({ event: "AUTO_ENABLE_ALERT_CHANNEL_CREATE_FAILED", userId, error });
      });
      channels = await this.getNotificationChannels(userId);
    }

    return channels?.data?.[0]?.id;
  }

  private async getNotificationChannels(userId: string) {
    return backOff(
      () => this.notificationsApi.v1.getNotificationChannels({ page: 1, limit: 1 }, { headers: { "x-user-id": userId } }),
      DEFAULT_BACKOFF_OPTIONS
    );
  }

  private calculateAlertThreshold(escrowBalance: number): number | undefined {
    if (!Number.isFinite(escrowBalance) || escrowBalance <= 0) return undefined;
    const threshold = Math.ceil(DEPLOYMENT_BALANCE_ALERT_THRESHOLD_RATIO * escrowBalance);
    if (!Number.isFinite(threshold) || threshold <= 0) return undefined;
    return threshold;
  }

  private async upsertDeploymentBalanceAlert(input: { userId: string; walletAddress: string; dseq: string; channelId: string; threshold: number }) {
    await backOff(
      () =>
        this.notificationsApi.v1.upsertDeploymentAlert(
          {
            dseq: input.dseq,
            data: {
              alerts: {
                deploymentBalance: { notificationChannelId: input.channelId, enabled: true, threshold: input.threshold },
                deploymentClosed: { notificationChannelId: input.channelId, enabled: true }
              }
            }
          },
          { headers: { "x-owner-address": input.walletAddress, "x-user-id": input.userId } }
        ),
      DEFAULT_BACKOFF_OPTIONS
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
  escrowBalance: number;
}

export type CreateNotificationInput = NotificationsInternalOperationDefs["createNotification"]["requestBody"]["content"]["application/json"] & {
  user: UserInput;
};
