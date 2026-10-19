import { inject, singleton } from "tsyringe";

import { type ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { UserRepository } from "@src/user/repositories";
import { apiKeyExpiryReminderNotification } from "./api-key-expiry-reminder-notification";

export class ApiKeyExpiryReminderJob implements Job {
  static readonly [JOB_NAME] = "ApiKeyExpiryReminderJob";
  readonly name = ApiKeyExpiryReminderJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { apiKeyId: string; expiresAt: string; daysBeforeExpiry: number }) {}
}

@singleton()
export class ApiKeyExpiryReminderHandler implements JobHandler<ApiKeyExpiryReminderJob> {
  public readonly accepts = ApiKeyExpiryReminderJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ApiKeyExpiryReminderHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Keys of one owner and organization that expire at the same moment share one email, sent by the job of the first of them. */
  async handle({ apiKeyId, expiresAt, daysBeforeExpiry }: JobPayload<ApiKeyExpiryReminderJob>): Promise<void> {
    const apiKeyRepository = this.apiKeyRepository.unscoped("api-key-expiry-reminders");
    const apiKey = await apiKeyRepository.findById(apiKeyId);
    const owner = apiKey && (await this.userRepository.findById(apiKey.userId));
    const skipReason = whyNotToRemind(apiKey, expiresAt) ?? (owner?.email ? undefined : "Owner has no email");

    if (!apiKey || !owner || skipReason) {
      this.#logger.info({ event: "API_KEY_EXPIRY_REMINDER_SKIPPED", apiKeyId, daysBeforeExpiry, reason: skipReason });
      return;
    }

    const keysExpiringTogether = await apiKeyRepository.findExpiringTogether({ userId: apiKey.userId, organizationId: apiKey.organizationId, expiresAt });

    if (keysExpiringTogether[0]?.id !== apiKeyId) {
      this.#logger.info({
        event: "API_KEY_EXPIRY_REMINDER_SKIPPED",
        apiKeyId,
        daysBeforeExpiry,
        reason: "Reminded with another key expiring at the same time"
      });
      return;
    }

    await this.notificationService.createNotificationOnce(
      apiKeyExpiryReminderNotification(owner, {
        apiKeyId,
        keys: keysExpiringTogether.map(({ name, keyFormat }) => ({ name, keyFormat })),
        expiresAt,
        daysBeforeExpiry,
        apiKeysUrl: this.#apiKeysUrl(apiKey.organizationId)
      })
    );
    this.#logger.info({ event: "API_KEY_EXPIRY_REMINDER_SENT", apiKeyId, keys: keysExpiringTogether.length, daysBeforeExpiry });
  }

  #apiKeysUrl(organizationId: string | null): string {
    const url = `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/user/api-keys`;

    return organizationId ? `${url}?org=${encodeURIComponent(organizationId)}` : url;
  }
}

function whyNotToRemind(apiKey: ApiKeyOutput | undefined, expiresAt: string): string | undefined {
  if (!apiKey) return "API key was revoked";
  if (!apiKey.expiresAt || new Date(apiKey.expiresAt).getTime() !== new Date(expiresAt).getTime()) return "API key expiry changed";
  if (new Date(expiresAt) <= new Date()) return "API key already expired";

  return undefined;
}
