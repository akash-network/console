import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import { ExponentialBackoff, handleAll, retry, type RetryPolicy } from "cockatiel";
import { inject, singleton } from "tsyringe";

import { VerifiedEmailService } from "@src/auth/services/verified-email/verified-email.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { accountEmailHeaders, NOTIFICATIONS_IDENTITY_HEADERS } from "@src/notifications/lib/identity-headers/identity-headers";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { UserRepository } from "@src/user/repositories";
import type { NotificationsApiClient, NotificationsInternalApiClient, NotificationsInternalOperationDefs } from "../../providers/notifications-api.provider";
import { NOTIFICATIONS_API_CLIENT, NOTIFICATIONS_INTERNAL_API_CLIENT } from "../../providers/notifications-api.provider";

const CHANNELS_CONSIDERED_FOR_AUTO_ENABLED_ALERTS = 100;

const TEAM_DEPLOYMENT_ALERTS_CHANNEL_NAME = "Deployment alerts";

function preferredChannelId(channels: { id: string; isDefault?: boolean }[] | undefined): string | undefined {
  return (channels?.find(channel => channel.isDefault) ?? channels?.[0])?.id;
}

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
    private readonly verifiedEmailService: VerifiedEmailService,
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
    const { user, notification } = addressedToAccount(input);
    let defaultChannelCreated = false;
    const headers = await this.#userIdentityHeaders(user.id);
    await this.#retryPolicy.execute(async () => {
      try {
        await this.notificationsInternalApi.v1.createNotification(notification, { headers });
      } catch (error) {
        if (!defaultChannelCreated && extractApiErrorCode(error) === "NOTIFICATION_CHANNEL_NOT_FOUND") {
          await this.createDefaultChannel(user);
          defaultChannelCreated = true;
        }
        throw new Error("Failed to create notification", { cause: error });
      }
    });
  }

  /** For callers that retry on their own: one attempt, plus one more right after opening a missing default channel. */
  async createNotificationOnce(input: CreateNotificationInput): Promise<void> {
    const { user, notification } = addressedToAccount(input);
    const headers = await this.#userIdentityHeaders(user.id);
    const send = () => this.notificationsInternalApi.v1.createNotification(notification, { headers });

    try {
      await send().catch(async error => {
        if (extractApiErrorCode(error) !== "NOTIFICATION_CHANNEL_NOT_FOUND") throw error;

        await this.notificationsApi.v1.createDefaultNotificationChannel(defaultChannelInput(user.email, user.timezone), {
          headers: { ...headers, ...(await this.#accountEmailHeaders(user, "cached")) }
        });
        await send();
      });
    } catch (error) {
      throw new Error("Failed to create notification", { cause: error });
    }
  }

  async createDefaultChannel(user: UserInput): Promise<void> {
    await this.#createDefaultChannel(user, "cached");
  }

  /** Confirms the user's email on their channels once Auth0 reports it verified, reading Auth0 afresh because the cached read can predate the verification. */
  async confirmAccountEmail(user: UserInput): Promise<void> {
    await this.#createDefaultChannel(user, "fresh");
  }

  async #createDefaultChannel(user: UserInput, verification: Verification): Promise<void> {
    const headers = { ...(await this.#userIdentityHeaders(user.id)), ...(await this.#accountEmailHeaders(user, verification)) };
    await this.#retryPolicy.execute(async () => {
      try {
        await this.notificationsApi.v1.createDefaultNotificationChannel(defaultChannelInput(user.email!, user.timezone), { headers });
      } catch (error) {
        throw new Error("Failed to create default notification channel", { cause: error });
      }
    });
  }

  /** Answers false for a link that confirms nothing, so the caller can tell it apart from a failure. */
  async confirmAddress(token: string): Promise<boolean> {
    try {
      await this.notificationsInternalApi.v1.confirmAddress({ token });
      return true;
    } catch (error) {
      if (extractApiErrorCode(error) === "INVALID_CONFIRMATION_LINK") {
        return false;
      }

      throw error;
    }
  }

  /** The personal organization tells the notifications service which of the user's rows to purge: those of team organizations stay with them. */
  async purgeUserData(userId: string, personalOrganizationId: string | null): Promise<void> {
    const headers: Record<string, string> = personalOrganizationId ? { [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: personalOrganizationId } : {};
    await this.#retryPolicy.execute(async () => this.notificationsInternalApi.v1.purge({ userId }, { headers }));
  }

  /** One attempt, for the job that calls it retries on its own. */
  async moveDeploymentAlertsToProject({ organizationId, deployment: { owner, dseq }, projectId }: MoveDeploymentAlertsInput): Promise<void> {
    await this.notificationsInternalApi.v1.moveDeploymentAlertsToProject({ organizationId, dseq, data: { owner, projectId } });
  }

  /** Leaves retrying to the job that calls it. */
  async releaseDepartedMemberAddress({ organizationId, ...data }: ReleaseDepartedMemberAddressInput): Promise<void> {
    await this.notificationsInternalApi.v1.releaseDepartedMember({ organizationId, data });
  }

  /** Leaves retrying to the job that calls it. */
  async purgeOrganizationData(organizationId: string): Promise<void> {
    await this.notificationsInternalApi.v1.purgeOrganization({ organizationId });
  }

  async autoEnableDeploymentAlert(input: AutoEnableDeploymentAlertInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user?.email) {
      this.#logger.debug({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No user email", userId: input.userId });
      return;
    }

    const deploymentHeaders = await this.#deploymentIdentityHeaders(input);
    const channelId =
      deploymentHeaders[NOTIFICATIONS_IDENTITY_HEADERS.organizationType] === "team"
        ? await this.#getOrCreateTeamChannelId(deploymentHeaders, { id: input.userId, userId: user.userId, email: user.email })
        : await this.getOrCreateNotificationChannelId(deploymentHeaders, {
            id: input.userId,
            userId: user.userId,
            email: user.email,
            timezone: user.timezone
          });
    if (!channelId) {
      this.#logger.warn({ event: "SKIP_AUTO_ENABLE_ALERT", reason: "No channel found after creation", userId: input.userId });
      return;
    }

    await this.upsertDeploymentClosedAlert(deploymentHeaders, { walletAddress: input.walletAddress, dseq: input.dseq, channelId });
  }

  private async getOrCreateNotificationChannelId(deploymentHeaders: Record<string, string>, user: UserInput): Promise<string | undefined> {
    let channels = await this.getNotificationChannels(deploymentHeaders);

    if (!channels?.data?.length) {
      // Treat the create as best-effort: a concurrent autoEnableDeploymentAlert for the
      // same user may have already won the race, so swallow the create error and let the
      // re-fetch decide whether a channel is now available.
      await this.createDefaultChannel(user).catch(error => {
        this.#logger.debug({ event: "AUTO_ENABLE_ALERT_CHANNEL_CREATE_FAILED", userId: user.id, error });
      });
      channels = await this.getNotificationChannels(deploymentHeaders);
    }

    return preferredChannelId(channels?.data);
  }

  /** Notifies whoever deployed, through a channel of the deployment's organization, until teams choose their deployment alert recipients; re-lists after creating so concurrent leases converge on the oldest channel. */
  async #getOrCreateTeamChannelId(deploymentHeaders: Record<string, string>, user: UserInput & { email: string }): Promise<string> {
    const channels = await this.getNotificationChannels(deploymentHeaders);
    const existingChannelId = preferredChannelId(channels?.data);

    if (existingChannelId) {
      return existingChannelId;
    }

    const { data: created } = await this.#retryPolicy.execute(async () =>
      this.notificationsApi.v1.createNotificationChannel(
        { data: { name: TEAM_DEPLOYMENT_ALERTS_CHANNEL_NAME, type: "email", config: { addresses: [user.email] }, isDefault: false } },
        { headers: { ...deploymentHeaders, ...(await this.#accountEmailHeaders(user, "cached")) } }
      )
    );
    const channelsAfterCreate = await this.getNotificationChannels(deploymentHeaders);

    return preferredChannelId(channelsAfterCreate?.data) ?? created.id;
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

  /** Treats an Auth0 lookup that fails as unverified, which leaves the email waiting until a later default channel request confirms it. */
  async #accountEmailHeaders(user: UserInput, verification: Verification): Promise<Record<string, string>> {
    const verifiedEmail = await this.#verifiedEmailOf(user, verification).catch(error => {
      this.#logger.warn({ event: "ACCOUNT_EMAIL_VERIFICATION_LOOKUP_FAILED", userId: user.id, error });
      return null;
    });

    return accountEmailHeaders({ email: user.email, verifiedEmail });
  }

  async #verifiedEmailOf(user: UserInput, verification: Verification): Promise<string | null> {
    const auth0UserId = user.userId ?? (await this.userRepository.findById(user.id))?.userId;

    if (!auth0UserId) {
      return null;
    }

    return verification === "fresh"
      ? await this.verifiedEmailService.getVerifiedEmail(auth0UserId)
      : await this.verifiedEmailService.getRecentVerifiedEmail(auth0UserId);
  }

  /** Attributes what the user writes outside a request to their personal organization, which keeps transactional emails on their own default channel. */
  async #userIdentityHeaders(userId: string): Promise<Record<string, string>> {
    const organization = await this.organizationRepository.findPersonalByUserId(userId);
    const headers = { [NOTIFICATIONS_IDENTITY_HEADERS.userId]: userId };

    return organization
      ? { ...headers, [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: organization.id, [NOTIFICATIONS_IDENTITY_HEADERS.organizationType]: organization.type }
      : headers;
  }

  async #deploymentIdentityHeaders({ userId, walletAddress, dseq }: AutoEnableDeploymentAlertInput): Promise<Record<string, string>> {
    const tenancy = await this.deploymentSettingRepository.findTenancy({ walletAddress, dseq });

    if (!tenancy) {
      return this.#userIdentityHeaders(userId);
    }

    return {
      [NOTIFICATIONS_IDENTITY_HEADERS.userId]: userId,
      [NOTIFICATIONS_IDENTITY_HEADERS.organizationId]: tenancy.organizationId,
      [NOTIFICATIONS_IDENTITY_HEADERS.organizationType]: tenancy.organizationType,
      ...(tenancy.projectId && { [NOTIFICATIONS_IDENTITY_HEADERS.projectId]: tenancy.projectId })
    };
  }
}

/** The email goes to the account's own address alone, never to the other addresses on its alert channel. */
function addressedToAccount({ user, ...notification }: CreateNotificationInput) {
  const { email } = user;

  if (!email) {
    throw new Error("Failed to create notification: the user has no email address");
  }

  return { user: { ...user, email }, notification: { ...notification, recipient: email } };
}

function defaultChannelInput(email: string, timezone: string | null | undefined) {
  return { data: { name: "Default", type: "email" as const, config: { addresses: [email] }, ...(timezone && { timezone }) } };
}

type Verification = "cached" | "fresh";

interface UserInput {
  id: string;
  /** The user's Auth0 id, looked up from `id` when missing. */
  userId?: string | null;
  email?: string | null;
  timezone?: string | null;
}

export interface ReleaseDepartedMemberAddressInput {
  organizationId: string;
  addressSha256: string;
  fallbackAddresses: string[];
}

export interface AutoEnableDeploymentAlertInput {
  userId: string;
  walletAddress: string;
  dseq: string;
}

export interface MoveDeploymentAlertsInput {
  organizationId: string;
  deployment: { owner: string; dseq: string };
  projectId: string;
}

export type CreateNotificationInput = Omit<
  NotificationsInternalOperationDefs["createNotification"]["requestBody"]["content"]["application/json"],
  "notificationChannelId" | "recipient"
> & {
  user: UserInput;
};
