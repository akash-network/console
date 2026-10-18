import { inject, singleton } from "tsyringe";

import { getDefaultApiKeyExpiry } from "@src/auth/lib/api-key-lifetime/api-key-lifetime";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
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
}

/** Every key without an expiration gets the same one, a full key lifetime from the run, so each owner is told one date. */
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
    const expiresAt = getDefaultApiKeyExpiry(new Date());
    const owners = await this.apiKeyRepository.unscoped("api-key-expiry-backfill").countKeysWithoutExpiryByOwner();
    const keysWithoutExpiry = owners.reduce((total, { keys }) => total + keys, 0);
    this.#logger.info({ event: "API_KEY_EXPIRY_BACKFILL_START", apply, expiresAt, owners: owners.length, keysWithoutExpiry });

    let keysAssigned = 0;

    if (apply) {
      for (const { userId } of owners) {
        keysAssigned += await this.#assignExpiry(userId, expiresAt);
      }
    }

    const report = { apply, expiresAt: expiresAt.toISOString(), owners: owners.length, keysWithoutExpiry, keysAssigned };
    this.#logger.info({ event: "API_KEY_EXPIRY_BACKFILL_END", report });

    return report;
  }

  async #assignExpiry(userId: string, expiresAt: Date): Promise<number> {
    return await this.txService.transaction(async () => {
      const keys = await this.apiKeyRepository.unscoped("api-key-expiry-backfill").assignExpiryToKeysWithoutOne(userId, expiresAt);

      for (const key of keys) {
        await this.expiryReminderScheduler.schedule(key);
      }

      if (keys.length > 0) {
        await this.jobQueueService.enqueue(
          new NotificationJob({
            template: "apiKeysExpiryAssigned",
            userId,
            vars: {
              keys: keys.map(({ name, keyFormat }) => ({ name, keyFormat })),
              expiresAt: expiresAt.toISOString(),
              apiKeysUrl: `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/user/api-keys`
            }
          })
        );
      }

      return keys.length;
    });
  }
}
