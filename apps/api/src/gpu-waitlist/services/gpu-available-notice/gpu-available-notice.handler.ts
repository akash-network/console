import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { gpuAlertLeaveUrl, gpuSetupDeployUrl, gpuSetupLabel } from "@src/gpu-waitlist/lib/gpu-setup-links/gpu-setup-links";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { HardwareRequestAccountService } from "@src/hardware-request/services/hardware-request-account/hardware-request-account.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { gpuAvailableNotification } from "@src/notifications/services/notification-templates/gpu-available-notification";
import { UserRepository } from "@src/user/repositories";
import { GpuAvailableNoticeJob } from "./gpu-available-notice.job";

@singleton()
export class GpuAvailableNoticeHandler implements JobHandler<GpuAvailableNoticeJob> {
  public readonly accepts = GpuAvailableNoticeJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly userRepository: UserRepository,
    private readonly hardwareRequestAccountService: HardwareRequestAccountService,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuAvailableNoticeHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ entryId, waveNumber, priceUsdPerHour }: JobPayload<GpuAvailableNoticeJob>): Promise<void> {
    const entry = await this.gpuWaitlistEntryRepository.findByIdAcrossOrganizations(entryId);

    if (entry?.status !== "waiting") {
      this.#logger.info({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId, reason: entry ? "Entry is no longer waiting" : "Entry not found" });
      return;
    }

    const user = await this.userRepository.findById(entry.userId);

    if (!user?.email) {
      this.#logger.warn({ event: "GPU_AVAILABLE_NOTICE_SKIPPED", entryId, reason: "User or email not found" });
      return;
    }

    const baseUrl = this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL");
    const accountType = await this.hardwareRequestAccountService.findAccountType({ userId: entry.userId, organizationId: entry.organizationId });

    await this.notificationService.createNotificationOnce(
      gpuAvailableNotification(user, {
        entryId,
        waveNumber,
        priceUsdPerHour,
        setupLabel: gpuSetupLabel(entry),
        isTrial: accountType === "trial",
        deployUrl: gpuSetupDeployUrl(baseUrl, entry, entry.organizationId),
        leaveUrl: gpuAlertLeaveUrl(baseUrl, entryId, entry.organizationId)
      })
    );
  }
}
