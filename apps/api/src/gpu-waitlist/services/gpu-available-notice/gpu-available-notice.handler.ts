import { inject, singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { gpuAlertLeaveUrl, gpuSetupDeployUrl, gpuSetupLabel } from "@src/gpu-waitlist/lib/gpu-setup-links/gpu-setup-links";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
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
    private readonly userWalletRepository: UserWalletRepository,
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

    await this.notificationService.createNotification(
      gpuAvailableNotification(user, {
        entryId,
        waveNumber,
        priceUsdPerHour,
        setupLabel: gpuSetupLabel(entry),
        isTrial: await this.#isTrialing(entry),
        deployUrl: gpuSetupDeployUrl(baseUrl, entry),
        leaveUrl: gpuAlertLeaveUrl(baseUrl, entryId)
      })
    );
  }

  async #isTrialing(entry: GpuWaitlistEntryRow): Promise<boolean> {
    const wallets = this.userWalletRepository.unscoped("gpu-waitlist-watcher");
    const wallet = entry.organizationId ? await wallets.findOneByOrganizationId(entry.organizationId) : await wallets.findOneByUserId(entry.userId);

    return wallet?.isTrialing !== false;
  }
}
