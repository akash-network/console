import groupBy from "lodash/groupBy";
import { inject, singleton } from "tsyringe";

import { getDefaultApiKeyExpiry } from "@src/auth/lib/api-key-lifetime/api-key-lifetime";
import { type ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyExpiryReminderScheduler } from "@src/auth/services/api-key-expiry-reminder/api-key-expiry-reminder-scheduler.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY, TxService } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationJob } from "@src/notifications/services/notification-handler/notification.handler";

export interface ApiKeyExpiryBackfillOptions {
  apply: boolean;
}

export interface ApiKeyExpiryBackfillReport {
  apply: boolean;
  expiresAt: string;
  owners: number;
  keysWithoutExpiry: number;
  keysAssigned: number;
  keysWithExpiry: number;
  remindersScheduled: number;
}

/** Every key without an expiration gets the same one, a full key lifetime from the run, so each owner is told one date per organization. */
@singleton()
export class ApiKeyExpiryBackfillService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly expiryReminderScheduler: ApiKeyExpiryReminderScheduler,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ApiKeyExpiryBackfillService.name });
  }

  async backfill({ apply }: ApiKeyExpiryBackfillOptions): Promise<ApiKeyExpiryBackfillReport> {
    const now = new Date();
    const expiresAt = getDefaultApiKeyExpiry(now);
    const apiKeyRepository = this.apiKeyRepository.unscoped("api-key-expiry-backfill");
    const keysWithExpiry = await apiKeyRepository.findExpiringAfter(now);
    const owners = await apiKeyRepository.countKeysWithoutExpiryByOwner();
    const keysWithoutExpiry = owners.reduce((total, { keys }) => total + keys, 0);
    this.#logger.info({
      event: "API_KEY_EXPIRY_BACKFILL_START",
      apply,
      expiresAt,
      owners: owners.length,
      keysWithoutExpiry,
      keysWithExpiry: keysWithExpiry.length
    });

    let keysAssigned = 0;
    let remindersScheduled = 0;

    if (apply) {
      remindersScheduled = await this.#scheduleMissingReminders(keysWithExpiry);

      for (const { userId } of owners) {
        keysAssigned += await this.#assignExpiry(userId, expiresAt);
      }
    }

    const report = {
      apply,
      expiresAt: expiresAt.toISOString(),
      owners: owners.length,
      keysWithoutExpiry,
      keysAssigned,
      keysWithExpiry: keysWithExpiry.length,
      remindersScheduled
    };
    this.#logger.info({ event: "API_KEY_EXPIRY_BACKFILL_END", report });

    return report;
  }

  /** Keys created with an expiration before reminders existed have none queued; the ones already queued are skipped so a rerun adds nothing. */
  async #scheduleMissingReminders(keys: ApiKeyOutput[]): Promise<number> {
    const alreadyScheduled = await this.expiryReminderScheduler.findScheduledReminders();
    let scheduled = 0;

    for (const key of keys) {
      scheduled += await this.expiryReminderScheduler.schedule(key, { alreadyScheduled });
    }

    return scheduled;
  }

  async #assignExpiry(userId: string, expiresAt: Date): Promise<number> {
    return await this.txService.transaction(async () => {
      const keys = await this.apiKeyRepository.unscoped("api-key-expiry-backfill").assignExpiryToKeysWithoutOne(userId, expiresAt);

      for (const key of keys) {
        await this.expiryReminderScheduler.schedule(key);
      }

      for (const keysOfOrganization of Object.values(groupBy(keys, key => key.organizationId))) {
        await this.#notifyOwner(userId, keysOfOrganization, expiresAt);
      }

      return keys.length;
    });
  }

  async #notifyOwner(userId: string, keys: ApiKeyOutput[], expiresAt: Date): Promise<void> {
    const { organizationId } = keys[0];
    const apiKeysUrl = `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/user/api-keys`;

    await this.jobQueueService.enqueue(
      new NotificationJob({
        template: "apiKeysExpiryAssigned",
        userId,
        vars: {
          organizationId,
          keys: keys.map(({ name, keyFormat }) => ({ name, keyFormat })),
          expiresAt: expiresAt.toISOString(),
          apiKeysUrl: organizationId ? `${apiKeysUrl}?org=${encodeURIComponent(organizationId)}` : apiKeysUrl
        }
      })
    );
  }
}
