import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { ExponentialBackoff, handleAll, retry, type RetryPolicy } from "cockatiel";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { NOTIFICATIONS_IDENTITY_HEADERS } from "@src/notifications/lib/identity-headers/identity-headers";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, NotificationsInternalApiClient, NotificationsInternalOperationDefs } from "../../providers/notifications-api.provider";
import { NOTIFICATIONS_API_CLIENT, NOTIFICATIONS_INTERNAL_API_CLIENT } from "../../providers/notifications-api.provider";

const CHANNELS_CONSIDERED_FOR_AUTO_ENABLED_ALERTS = 100;

@singleton()
export class NotificationService {
  readonly #logger: ReturnType<CreateLogger>;
  readonly #retryPolicy: RetryPolicy;

  constructor(
    @inject(NOTIFICATIONS_API_CLIENT) private readonly notificationsApi: NotificationsApiClient,
    @inject(NOTIFICATIONS_INTERNAL_API_CLIENT) private readonly notificationsInternalApi: NotificationsInternalApiClient,
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
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
    const headers = await this.#userIdentityHeaders(user.id);
    await this.#retryPolicy.execute(async () => {
      try {
        await this.notificationsInternalApi.v1.createNotification(notification, { headers });
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
    const headers = await this.#userIdentityHeaders(user.id);
    await this.#retryPolicy.execute(async () => {
      try {
        await this.notificationsApi.v1.createDefaultNotificationChannel(
          { data: { name: "Default", type: "email", config: { addresses: [user.email!] } } },
          { headers }
        );
      } catch (error) {
        throw new Error("Failed to create default notification channel", { cause: error });
      }
    });
  }

  /** The personal organization tells the notifications service which of the user's rows to purge: those of team organizations stay with them. */
  async purgeUserData(userId: string, personalOrganizationId: string | null): Promise<void> {
    const headers: Record<string, string> = personalOrganizationId ? { [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: personalOrganizationId } : {};
    await this.#retryPolicy.execute(async () => this.notificationsInternalApi.v1.purge({ userId }, { headers }));
  }

  async autoEnableDeploymentAlert(input: AutoEnableDeploymentAlertInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user?.email) {
      this.#logger.debug({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No user email", userId: input.userId });
      return;
    }

    const deploymentHeaders = await this.#deploymentIdentityHeaders(input);
    const channelId = await this.getOrCreateNotificationChannelId(deploymentHeaders, input.userId, user.email);
    if (!channelId) {
      this.#logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No channel found after creation", userId: input.userId });
      return;
    }

    await this.upsertDeploymentClosedAlert(deploymentHeaders, { walletAddress: input.walletAddress, dseq: input.dseq, channelId });
  }

  private async getOrCreateNotificationChannelId(deploymentHeaders: Record<string, string>, userId: string, email: string): Promise<string | undefined> {
    let channels = await this.getNotificationChannels(deploymentHeaders);

    if (!channels?.data?.length) {
      // Treat the create as best-effort: a concurrent autoEnableDeploymentAlert for the
      // same user may have already won the race, so swallow the create error and let the
      // re-fetch decide whether a channel is now available.
      await this.createDefaultChannel({ id: userId, email }).catch(error => {
        this.#logger.debug({ event: "AUTO_ENABLE_ALERT_CHANNEL_CREATE_FAILED", userId, error });
      });
      channels = await this.getNotificationChannels(deploymentHeaders);
    }

    return (channels?.data?.find(channel => channel.isDefault) ?? channels?.data?.[0])?.id;
  }

  private async getNotificationChannels(headers: Record<string, string>) {
    return this.#retryPolicy.execute(async () => {
      return this.notificationsApi.v1.listNotificationChannels({ page: 1, limit: CHANNELS_CONSIDERED_FOR_AUTO_ENABLED_ALERTS }, { headers });
    });
  }

  private async upsertDeploymentClosedAlert(headers: Record<string, string>, input: { walletAddress: string; dseq: string; channelId: string }) {
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
        { headers: { ...headers, [NOTIFICATIONS_IDENTITY_HEADERS.ownerAddress]: input.walletAddress } }
      )
    );
  }

  /** Attributes what the user writes outside a request to their personal organization, which keeps transactional emails on their own default channel. */
  async #userIdentityHeaders(userId: string): Promise<Record<string, string>> {
    const organization = await this.organizationRepository.findPersonalByUserId(userId);
    const headers = { [NOTIFICATIONS_IDENTITY_HEADERS.userId]: userId };

    return organization ? { ...headers, [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: organization.id } : headers;
  }

  async #deploymentIdentityHeaders({ userId, dseq }: { userId: string; dseq: string }): Promise<Record<string, string>> {
    const tenancy = await this.deploymentSettingRepository.findTenancy({ userId, dseq });

    if (!tenancy?.organizationId) {
      return this.#userIdentityHeaders(userId);
    }

    const headers = { [NOTIFICATIONS_IDENTITY_HEADERS.userId]: userId, [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: tenancy.organizationId };

    return tenancy.projectId ? { ...headers, [NOTIFICATIONS_IDENTITY_HEADERS.projectId]: tenancy.projectId } : headers;
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
