import { AuthzHttpService, LeaseHttpService, LIVE_LEASE_STATES } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { inject, singleton } from "tsyringe";

import { UserWalletRepository, type WalletInitialized } from "@src/billing/repositories";
import { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type CreateLogger, LOGGER_FACTORY, TxService } from "@src/core";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { sanitizeEvidenceText } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export const ABUSE_LOCK_REASON = "workload_abuse";

export const BLOCKED_DOMAIN_LOCK_REASON = "blocked_domain";

export type AbuseLockReason = typeof ABUSE_LOCK_REASON | typeof BLOCKED_DOMAIN_LOCK_REASON;

export type EnforcementOutcome = {
  depositGrantRevoked: boolean;
  feeGrantRevoked: boolean;
  closedDseqs: string[];
};

/** The chain reports a revoke of a grant that no longer exists this way, which an earlier attempt of the same wipe can have caused. */
const GRANT_MISSING_PATTERN = /not found/i;

/**
 * Wipes a trial wallet caught mining: the deposit grant goes first so nothing new can be created, the live deployments
 * are closed while the fee grant still pays for the closes, then the fee grant goes and the wallet is zeroed and
 * locked in one write. Every step re-reads chain state, so a retry after a partial failure resumes where it stopped.
 */
@singleton()
export class TrialAbuseEnforcementService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly txManagerService: TxManagerService,
    private readonly authzHttpService: AuthzHttpService,
    private readonly rpcMessageService: RpcMessageService,
    private readonly signerService: ManagedSignerService,
    private readonly leaseHttpService: LeaseHttpService,
    private readonly deploymentWriterService: DeploymentWriterService,
    private readonly chainErrorService: ChainErrorService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly probeJobService: TrialWorkloadProbeJobService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TrialAbuseEnforcementService.name });
  }

  async enforce(input: { wallet: WalletInitialized; detectionId: string }): Promise<EnforcementOutcome | null> {
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
  async wipeTrialWallet(wallet: WalletInitialized, reason: AbuseLockReason): Promise<EnforcementOutcome | null> {
    return await this.txService.transaction(() => this.#wipeUnlessPaid(wallet, reason));
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
    const granter = await this.txManagerService.getFundingWalletAddress();
    const depositGrantRevoked = await this.#revokeDepositGrant(granter, wallet.address);
    const closedDseqs = await this.#closeLiveDeployments(wallet);
    const feeGrantRevoked = await this.#revokeFeeGrant(granter, wallet.address);
    await this.userWalletRepository.lockForAbuse(wallet.id, reason);
    await this.probeJobService.cancelForWallet(wallet.id);

    return { depositGrantRevoked, feeGrantRevoked, closedDseqs };
  }

  async #revokeDepositGrant(granter: string, grantee: string): Promise<boolean> {
    if (!(await this.authzHttpService.hasDepositDeploymentGrant(granter, grantee))) return false;

    await this.#executeRevoke(this.rpcMessageService.getRevokeDepositDeploymentGrantMsg({ granter, grantee }));
    return true;
  }

  async #revokeFeeGrant(granter: string, grantee: string): Promise<boolean> {
    if (!(await this.authzHttpService.hasFeeAllowance(granter, grantee))) return false;

    await this.#executeRevoke(this.rpcMessageService.getRevokeAllowanceMsg({ granter, grantee }));
    return true;
  }

  async #executeRevoke(message: EncodeObject): Promise<void> {
    try {
      await this.signerService.executeFundingTx([message]);
    } catch (error) {
      if (isGrantMissingError(error)) return;
      throw error;
    }
  }

  /** An unsettleable escrow is skipped for this pass and fails the run at the end, so the queue retries the close later without blocking the other deployments. */
  async #closeLiveDeployments(wallet: WalletInitialized): Promise<string[]> {
    const dseqs = await this.#findLiveDseqs(wallet.address);
    const closed: string[] = [];
    const unsettleable: string[] = [];

    for (const dseq of dseqs) {
      try {
        await this.deploymentWriterService.close(wallet, dseq);
        closed.push(dseq);
      } catch (error) {
        if (error instanceof Error && this.chainErrorService.isUnsettleableDeploymentError(error)) {
          unsettleable.push(dseq);
          continue;
        }
        throw error;
      }
    }

    if (unsettleable.length > 0) {
      throw new Error(`Deployments ${unsettleable.join(", ")} cannot be closed until their escrow settles`);
    }

    return closed;
  }

  async #findLiveDseqs(owner: string): Promise<string[]> {
    const responses = await Promise.all(LIVE_LEASE_STATES.map(state => this.leaseHttpService.list({ owner, state })));

    return [...new Set(responses.flatMap(response => response.leases.map(lease => lease.lease.id.dseq)))];
  }
}

function isGrantMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const originalError = (error as { originalError?: unknown }).originalError;
  const messages = [error.message, originalError instanceof Error ? originalError.message : undefined];

  return messages.some(message => message && GRANT_MISSING_PATTERN.test(message));
}

/** Postgres rejects NUL in text, so an error quoting bytes it read back would fail the very update that records the failure. */
function toStorableErrorMessage(error: unknown): string {
  return sanitizeEvidenceText(error instanceof Error ? error.message : String(error));
}
