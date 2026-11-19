import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { gpuAlertKeepUrl, gpuAlertLeaveUrl, gpuSetupLabel } from "@src/gpu-waitlist/lib/gpu-setup-links/gpu-setup-links";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { gpuStillWantedNotification } from "@src/notifications/services/notification-templates/gpu-alert-still-wanted-notification";
import { UserRepository } from "@src/user/repositories";
import { AskStillWanted } from "./ask-still-wanted.job";
import { ExpireGpuAlert } from "./expire-gpu-alert.job";

const DAY_MS = 24 * 60 * 60 * 1000;

@singleton()
export class AskStillWantedHandler implements JobHandler<AskStillWanted> {
  public readonly accepts = AskStillWanted;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly featureFlagsService: FeatureFlagsService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AskStillWantedHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ entryId }: JobPayload<AskStillWanted>): Promise<void> {
    if (!this.featureFlagsService.isEnabled(FeatureFlags.GPU_AVAILABILITY_ALERTS, {})) {
      await this.jobQueueService.enqueue(new AskStillWanted({ entryId }), { startAfter: new Date(Date.now() + DAY_MS) });
      this.#logger.info({ event: "GPU_STILL_WANTED_DEFERRED", entryId, reason: "Feature flag is off" });
      return;
    }

    const entry = await this.gpuWaitlistEntryRepository.findByIdAcrossOrganizations(entryId);
    const skipReason = this.#skipReasonFor(entry);

    if (skipReason || !entry) {
      this.#logger.info({ event: "GPU_STILL_WANTED_SKIPPED", entryId, reason: skipReason });
      return;
    }

    const user = await this.userRepository.findById(entry.userId);

    if (!user?.email) {
      this.#logger.warn({ event: "GPU_STILL_WANTED_SKIPPED", entryId, reason: "User or email not found" });
      return;
    }

    const baseUrl = this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL");

    await this.txService.transaction(async () => {
      const claimed = await this.gpuWaitlistEntryRepository.claimStillWantedQuestion(entryId);

      if (!claimed?.stillWantedAskedAt) {
        this.#logger.info({ event: "GPU_STILL_WANTED_SKIPPED", entryId, reason: "Entry was already asked or ended" });
        return;
      }

      const askedAt = claimed.stillWantedAskedAt;
      await this.jobQueueService.enqueue(new ExpireGpuAlert({ entryId }), {
        startAfter: new Date(askedAt.getTime() + this.config.GPU_WAITLIST_STILL_WANTED_GRACE_DAYS * DAY_MS)
      });
      await this.notificationService.createNotificationOnce(
        gpuStillWantedNotification(user, {
          entryId,
          askedAtEpochMs: askedAt.getTime(),
          setupLabel: gpuSetupLabel(entry),
          graceDays: this.config.GPU_WAITLIST_STILL_WANTED_GRACE_DAYS,
          keepUrl: gpuAlertKeepUrl(baseUrl, entryId, entry.organizationId),
          leaveUrl: gpuAlertLeaveUrl(baseUrl, entryId, entry.organizationId)
        })
      );
    });
  }

  #skipReasonFor(entry: GpuWaitlistEntryRow | undefined): string | undefined {
    if (!entry) return "Entry not found";
    if (entry.status !== "waiting") return "Entry is no longer waiting";
    if (entry.stillWantedAskedAt) return "Entry was already asked";

    return undefined;
  }
}
