import { inject, singleton } from "tsyringe";

import type { SystemCloseReason } from "@src/activity/model-schemas";
import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository, type DeploymentWallet } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";

export type SystemClose = { wallet: DeploymentWallet & { address: string }; dseq: string; reason: SystemCloseReason };

/** A team wallet belongs to no one, so a close Console made lands in the feed of the member the deployment was filed under, and a personal wallet's user stands in when there is no record. */
@singleton()
export class SystemCloseActivityService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly activityService: ActivityService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: SystemCloseActivityService.name });
  }

  /** The deployment has already closed by the time this runs, so a close with no one to show it to, or a failure to find them, is logged rather than raised. */
  async record({ wallet, dseq, reason }: SystemClose): Promise<void> {
    const log = { owner: wallet.address, organizationId: wallet.organizationId, dseq, closeReason: reason };

    try {
      const userId = await this.#deploymentUserOf(wallet, dseq);

      if (!userId) {
        this.#logger.warn({ event: "SYSTEM_CLOSE_ACTIVITY_SKIPPED", reason: "NO_DEPLOYMENT_USER", ...log });
        return;
      }

      await this.activityService.record(systemClosedActivityOf({ userId, owner: wallet.address, dseq, reason }));
    } catch (error) {
      this.#logger.error({ event: "SYSTEM_CLOSE_ACTIVITY_RECORD_FAILED", ...log, error });
    }
  }

  async #deploymentUserOf(wallet: DeploymentWallet, dseq: string): Promise<string | null> {
    const deployment = await this.deploymentSettingRepository.unscoped("deployment-activity").findOneOwnedByWallet(wallet, dseq);

    return deployment?.userId ?? wallet.userId;
  }
}
