import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { ActivateTrial } from "@src/billing/events/activate-trial";
import { TrialEligibilityService } from "@src/billing/services/trial-eligibility/trial-eligibility.service";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import type { UserOutput } from "@src/user/repositories";
import { AccountStatusGuard } from "@src/user/services/account-status-guard/account-status-guard.service";

@singleton()
export class TrialActivationJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly accountStatusGuard: AccountStatusGuard,
    private readonly trialEligibilityService: TrialEligibilityService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialActivationJobService.name });
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
   * Guards a managed-wallet spend that needs the trial's on-chain grants in place. When the wallet isn't activated yet it (best-effort) re-requests activation and throws a retriable
   * `wallet_provisioning` 409, so the client waits for provisioning to land instead of hitting a bare chain/funding
   * error. A failed re-enqueue is logged but still yields the 409 — the next client retry re-requests it.
   * A suspended or terminated account is refused with its own 403 instead, and a user whose trial is refused gets
   * that refusal, since neither wallet is ever activated and a 409 would have the client retry forever.
   */
  async assertActivated(wallet: { userId: UserOutput["id"]; activatedAt?: Date | null }): Promise<void> {
    if (wallet.activatedAt) return;

    await this.accountStatusGuard.assertUserMaySpend(wallet.userId);
    await this.trialEligibilityService.assertEligible(wallet.userId);
    await this.#requestActivation(wallet.userId);
  }

  /** Guards a payment into a personal wallet: it waits for a trial still on its way, so paying does not forfeit it, and lets through an account refused its trial, whose wallet the payment activates. */
  async assertActivatedOrTrialRefused(wallet: { userId: UserOutput["id"]; activatedAt?: Date | null }): Promise<void> {
    if (wallet.activatedAt) return;

    await this.accountStatusGuard.assertUserMaySpend(wallet.userId);
    if (await this.trialEligibilityService.isRefused(wallet.userId)) return;

    await this.#requestActivation(wallet.userId);
  }

  async #requestActivation(userId: UserOutput["id"]): Promise<never> {
    try {
      await this.schedule(userId);
    } catch (error) {
      this.logger.error({ event: "FAILED_TO_SCHEDULE_TRIAL_ACTIVATION", userId, error });
    }
    throw createError(409, "Wallet is still being provisioned, please retry shortly", { errorCode: "wallet_provisioning" });
  }
}
