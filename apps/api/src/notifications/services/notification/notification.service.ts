import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { backOff, type BackoffOptions } from "exponential-backoff";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, operations } from "../../providers/notifications-api.provider";
import { NOTIFICATIONS_API_CLIENT } from "../../providers/notifications-api.provider";

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
    private readonly userRepository: UserRepository,
    private readonly deploymentHttpService: DeploymentHttpService,
    private readonly logger: LoggerService
  ) {}

  async createNotification(input: CreateNotificationInput): Promise<void> {
    const { user, ...notification } = input;
    await backOff(async () => {
      const result = await this.notificationsApi.v1
        .createNotification({
          parameters: {
            header: {
              "x-user-id": user.id
            }
          } as any,
          body: notification
        })
        .catch(error => ({ error, response: null }));

      if (!result.error) return;

      if (result.error.code === "NOTIFICATION_CHANNEL_NOT_FOUND" && user.email) {
        await this.createDefaultChannel(user);
      }

      throw new Error("Failed to create notification", { cause: result.error });
    }, DEFAULT_BACKOFF_OPTIONS);
  }

  async createDefaultChannel(user: UserInput): Promise<void> {
    await backOff(async () => {
      const result = await this.notificationsApi.v1
        .createDefaultChannel({
          parameters: {
            header: {
              "x-user-id": user.id
            } as any
          },
          body: {
            data: {
              name: "Default",
              type: "email",
              config: {
                addresses: [user.email!]
              }
            }
          }
        })
        .catch(error => ({ error, response: null }));

      if (!result.error) return;

      throw new Error("Failed to create default notification channel", { cause: result.error });
    }, DEFAULT_BACKOFF_OPTIONS);
  }

  async autoEnableDeploymentAlert(input: { userId: string; walletAddress: string; dseq: string }): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user?.email) {
      this.logger.debug({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No user email", userId: input.userId });
      return;
    }

    await this.createDefaultChannel({ id: input.userId, email: user.email });

    const channelsResult = await this.notificationsApi.v1.getNotificationChannels({
      parameters: { header: { "x-user-id": input.userId }, query: { page: 1, limit: 1 } } as any
    });
    const channelId = channelsResult?.data?.data?.[0]?.id;
    if (!channelId) {
      this.logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No channel found after creation", userId: input.userId });
      return;
    }

    const deployment = await this.deploymentHttpService.findByOwnerAndDseq(input.walletAddress, input.dseq);
    if ("code" in deployment) {
      this.logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "Deployment not found", dseq: input.dseq });
      return;
    }

    const escrowBalance = deployment.escrow_account.state.funds.reduce((sum, { amount }) => sum + parseFloat(amount), 0);
    const threshold = Math.ceil(0.3 * escrowBalance);
    if (threshold === 0) return;

    await this.notificationsApi.v1.upsertDeploymentAlert({
      parameters: {
        path: { dseq: input.dseq },
        header: { "x-owner-address": input.walletAddress, "x-user-id": input.userId } as any
      },
      body: {
        data: {
          alerts: {
            deploymentBalance: { notificationChannelId: channelId, enabled: true, threshold }
          }
        }
      }
    });
  }
}

interface UserInput {
  id: string;
  email?: string | null;
}

export type CreateNotificationInput = operations["createNotification"]["requestBody"]["content"]["application/json"] & {
  user: UserInput;
};
