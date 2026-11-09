import { inject, singleton } from "tsyringe";

import { type PersonalWallet, UserWalletRepository, type WalletInitialized } from "@src/billing/repositories";
import { WalletGrantRevokerService } from "@src/billing/services/wallet-grant-revoker/wallet-grant-revoker.service";
import { type CreateLogger, LOGGER_FACTORY, TxService } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { CloseWalletDeploymentsService } from "@src/deployment/services/close-wallet-deployments/close-wallet-deployments.service";
import { ABUSE_LOCK_REASON, type AbuseLockReason } from "@src/workload-abuse/lib/abuse-lock-reason/abuse-lock-reason";
import { sanitizeEvidenceText } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export type EnforcementOutcome = {
  depositGrantRevoked: boolean;
  feeGrantRevoked: boolean;
  closedDseqs: string[];
};

/**
 * Wipes a trial wallet caught mining: the deposit grant goes first so nothing new can be created, every open
 * deployment, leased or not, is closed while the fee grant still pays for the closes, then the fee grant goes and the
 * wallet is zeroed and locked in one write. Every step re-reads chain state, so a retry after a partial failure resumes where it stopped.
 */
@singleton()
export class TrialAbuseEnforcementService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletGrantRevokerService: WalletGrantRevokerService,
    private readonly closeWalletDeploymentsService: CloseWalletDeploymentsService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly probeJobService: TrialWorkloadProbeJobService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    private readonly txService: TxService,
    private readonly analyticsService: AnalyticsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialAbuseEnforcementService.name });
  }

  async enforce(input: { wallet: PersonalWallet; detectionId: string }): Promise<EnforcementOutcome | null> {
    const { wallet, detectionId } = input;
    await this.detectionRepository.updateById(detectionId, { action: "enforcing", enforcementError: null, updatedAt: new Date() });

    let outcome: EnforcementOutcome | null;

    try {
      outcome = await this.wipeTrialWallet(wallet, ABUSE_LOCK_REASON);
    } catch (error) {
      this.instrumentation.recordEnforcement("failed");
      this.logger.error({
        event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_FAILED",
        detectionId,
        walletId: wallet.id,
        userId: wallet.userId,
        owner: wallet.address,
        error
      });
      await this.#recordEnforcementFailure(detectionId, error);
      throw error;
    }

    if (!outcome) {
      await this.detectionRepository.updateById(detectionId, { action: "detected", enforcementError: null, updatedAt: new Date() });
      this.instrumentation.recordEnforcement("skipped");
      this.logger.info({
        event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_SKIPPED",
        reason: "PAID_DURING_ENFORCEMENT",
        detectionId,
        walletId: wallet.id,
        userId: wallet.userId,
        owner: wallet.address
      });
      return null;
    }

    await this.detectionRepository.markWalletEnforced(wallet.id);
    this.instrumentation.recordEnforcement("enforced");
    this.logger.warn({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCED", detectionId, walletId: wallet.id, userId: wallet.userId, owner: wallet.address, ...outcome });

    return outcome;
  }

  /** The wipe without the detection bookkeeping, for a wallet caught by its email domain rather than by its own workload. */
  async wipeTrialWallet(wallet: PersonalWallet, reason: AbuseLockReason): Promise<EnforcementOutcome | null> {
    const outcome = await this.txService.transaction(() => this.#wipeUnlessPaid(wallet, reason));

    if (outcome) {
      this.analyticsService.track(wallet.userId, "account_restricted", { reason });
    }

    return outcome;
  }

  /** findStalledEnforcements re-queues a detection left in enforcing, so a record that cannot be written is worth a log rather than the failure it was recording. */
  async #recordEnforcementFailure(detectionId: string, error: unknown): Promise<void> {
    try {
      await this.detectionRepository.updateById(detectionId, {
        action: "enforcement_failed",
        enforcementError: toStorableErrorMessage(error),
        updatedAt: new Date()
      });
    } catch (recordError) {
      this.logger.error({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECORD_FAILED", detectionId, error: recordError });
    }
  }

  /** Holds the wallet row for the whole wipe, so a payment settling at the same time waits for it and then clears the lock instead of re-granting between the revokes. */
  async #wipeUnlessPaid(wallet: WalletInitialized, reason: AbuseLockReason): Promise<EnforcementOutcome | null> {
    const lockedWallet = await this.userWalletRepository.findOneByAndLock({ id: wallet.id });

    if (!lockedWallet?.isTrialing) return null;

    return await this.#wipe(wallet, reason);
  }

  /** The lock and the probe cancellations ride the row-lock transaction, so a wipe that fails partway rolls them back and leaves the wallet unlocked and still monitored for the retry. */
  async #wipe(wallet: WalletInitialized, reason: AbuseLockReason): Promise<EnforcementOutcome> {
    const depositGrantRevoked = await this.walletGrantRevokerService.revokeDepositGrant(wallet.address);
    const closedDseqs = await this.closeWalletDeploymentsService.closeAllOf(wallet);
    const feeGrantRevoked = await this.walletGrantRevokerService.revokeFeeGrant(wallet.address);
    await this.userWalletRepository.lockForAbuse(wallet.id, reason);
    await this.probeJobService.cancelForWallet(wallet.id);

    return { depositGrantRevoked, feeGrantRevoked, closedDseqs };
  }
}

/** Postgres rejects NUL in text, so an error quoting bytes it read back would fail the very update that records the failure. */
function toStorableErrorMessage(error: unknown): string {
  return sanitizeEvidenceText(error instanceof Error ? error.message : String(error));
}
