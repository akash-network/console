import { inject, singleton } from "tsyringe";

import type { SystemCloseReason } from "@src/activity/model-schemas";
import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import {
  DeploymentSettingRepository,
  type DeploymentSettingsOutput,
  type DeploymentWallet
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { systemClosedActivityOf } from "@src/deployment/utils/close-activity/close-activity";

export type SystemClose = { wallet: DeploymentWallet & { address: string }; dseq: string; reason: SystemCloseReason };

type DeploymentLookup = Promise<DeploymentSettingsOutput | undefined>;

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

  /** The deployment has already closed by the time this runs, so every failure is logged rather than raised, and the feed entry and the close reason are written whether or not the other is. */
  async record(close: SystemClose): Promise<void> {
    const deployment = this.#findDeployment(close);

    await this.#recordCloseReason(close, deployment);
    await this.#recordActivity(close, deployment);
  }

  async #findDeployment({ wallet, dseq }: SystemClose): DeploymentLookup {
    return await this.deploymentSettingRepository.unscoped("deployment-activity").findOneOwnedByWallet(wallet, dseq);
  }

  async #recordActivity(close: SystemClose, deployment: DeploymentLookup): Promise<void> {
    const { wallet, dseq, reason } = close;

    try {
      const userId = (await deployment)?.userId ?? wallet.userId;

      if (!userId) {
        this.#logger.warn({ event: "SYSTEM_CLOSE_ACTIVITY_SKIPPED", reason: "NO_DEPLOYMENT_USER", ...logFieldsOf(close) });
        return;
      }

      await this.activityService.record(systemClosedActivityOf({ userId, owner: wallet.address, dseq, reason }));
    } catch (error) {
      this.#logger.error({ event: "SYSTEM_CLOSE_ACTIVITY_RECORD_FAILED", ...logFieldsOf(close), error });
    }
  }

  /** Only the first close is kept, so the deployment page names the same reason as the feed entry, which a second report never replaces. */
  async #recordCloseReason(close: SystemClose, deployment: DeploymentLookup): Promise<void> {
    try {
      const setting = await deployment;

      if (!setting) {
        this.#logger.info({ event: "SYSTEM_CLOSE_REASON_SKIPPED", reason: "NO_DEPLOYMENT_RECORD", ...logFieldsOf(close) });
        return;
      }

      await this.deploymentSettingRepository
        .unscoped("deployment-activity")
        .updateBy({ id: setting.id, consoleCloseReason: null }, { consoleCloseReason: close.reason });
    } catch (error) {
      this.#logger.error({ event: "SYSTEM_CLOSE_REASON_RECORD_FAILED", ...logFieldsOf(close), error });
    }
  }
}

function logFieldsOf({ wallet, dseq, reason }: SystemClose) {
  return { owner: wallet.address, organizationId: wallet.organizationId, dseq, closeReason: reason };
}
