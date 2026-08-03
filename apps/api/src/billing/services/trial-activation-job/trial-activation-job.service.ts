import createError from "http-errors";
import { singleton } from "tsyringe";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import { JobQueueService, LoggerService } from "@src/core";
import type { UserOutput } from "@src/user/repositories";

@singleton()
export class TrialActivationJobService {
  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TrialActivationJobService.name);
  }

  /**
   * Enqueues background provisioning of a user's trial wallet (on-chain grants + activation). Deduplicated per
   * user via a singleton key, so registration, email verification, and the spend-side self-heal can all request
   * it without stacking jobs. Idempotent downstream: {@link WalletInitializerService.initializeAndGrantTrialLimits}
   * no-ops once the wallet is already activated.
   */
  async schedule(userId: UserOutput["id"]): Promise<void> {
    await this.jobQueueService.enqueue(new ActivateTrial({ userId }), {
      singletonKey: `${ActivateTrial.name}.${userId}`
    });
  }

  /**
   * Guards a managed-wallet action (a deployment spend, a paid top-up) that needs the trial's on-chain grants in
   * place. When the wallet isn't activated yet it (best-effort) re-requests activation and throws a retriable
   * `wallet_provisioning` 409, so the client waits for provisioning to land instead of hitting a bare chain/funding
   * error. A failed re-enqueue is logged but still yields the 409 — the next client retry re-requests it.
   */
  async assertActivated(wallet: { userId: UserOutput["id"]; activatedAt?: Date | null }): Promise<void> {
    if (wallet.activatedAt) return;

    try {
      await this.schedule(wallet.userId);
    } catch (error) {
      this.logger.error({ event: "FAILED_TO_SCHEDULE_TRIAL_ACTIVATION", userId: wallet.userId, error });
    }
    throw createError(409, "Wallet is still being provisioned, please retry shortly", { errorCode: "wallet_provisioning" });
  }
}
