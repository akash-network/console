import { MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { addMilliseconds, addMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { replayAllowance } from "@src/billing/lib/deployment-allowance-replay/deployment-allowance-replay";
import {
  DeploymentAllowanceHistoryRepository,
  type IndexedTx
} from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import { DeploymentSpendRepository } from "@src/billing/repositories/deployment-spend/deployment-spend.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";
import { type CreateLogger, type JobHandler, type JobMeta, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { type AllowanceCheck, ReconcileDeploymentAllowance } from "./reconcile-deployment-allowance.job";

const DEPOSIT_GRANT_MSG_TYPE_URL = `/${MsgAccountDeposit.$type}`;

/** Bounds the follow-up grants one write can start, since each one can overwrite a deposit of its own. */
export const MAX_FOLLOW_UP_WRITES = 5;

/** With a check every minute, this waits about half an hour for a chain index that has not reached the write. */
export const MAX_CHECK_ATTEMPTS = 30;

/** Must stay above tx-signer's UNORDERED_TX_TTL_MS, since a grant signed as TX_SIGNER_REQUEST_TIMEOUT_MS runs out can still land that long after. */
const LANDING_MARGIN_IN_MIN = 1;

@singleton()
export class ReconcileDeploymentAllowanceHandler implements JobHandler<ReconcileDeploymentAllowance> {
  public readonly accepts = ReconcileDeploymentAllowance;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentAllowanceHistoryRepository: DeploymentAllowanceHistoryRepository,
    private readonly deploymentSpendRepository: DeploymentSpendRepository,
    private readonly deploymentAllowanceService: DeploymentAllowanceService,
    private readonly txManagerService: TxManagerService,
    private readonly billingConfigService: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ReconcileDeploymentAllowanceHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A retried run cannot tell whether the run before it got a grant out, so it stops rather than risk granting twice; every failure known to have granted nothing is checked again instead. */
  async handle(check: JobPayload<ReconcileDeploymentAllowance>, job?: JobMeta): Promise<void> {
    if (job && job.retryCount > 0) {
      this.#logger.error({ event: "DEPLOYMENT_ALLOWANCE_CHECK_INTERRUPTED", ...this.#describe(check) });
      return;
    }

    try {
      if (await this.#reconcile(check)) return;
    } catch (error) {
      if (isUnknownTxOutcome(error)) {
        if (!error.txHash) this.#logger.error({ event: "DEPLOYMENT_ALLOWANCE_WRITE_UNDECIDED", ...this.#describe(check), error });
        return;
      }

      this.#logger.warn({ event: "DEPLOYMENT_ALLOWANCE_CHECK_FAILED", ...this.#describe(check), error });
    }

    await this.#checkAgain(check);
  }

  /** Reads the index tip before the write, since the index stores a block with its transactions, so a tip past the landing window means the lookup saw them all. */
  async #reconcile(check: AllowanceCheck): Promise<boolean> {
    const latestBlockTime = await this.deploymentSpendRepository.findLatestBlockTime();
    const tx = await this.deploymentAllowanceHistoryRepository.findTx(check.write.txHash);

    if (tx?.isSucceeded) {
      await this.#restore(check, await this.#overwrittenBy(check, tx));
      return true;
    }

    if (!tx && !this.#isPastLanding(check, latestBlockTime)) return false;

    this.#logger.info({ event: "DEPLOYMENT_ALLOWANCE_WRITE_NOT_LANDED", ...this.#describe(check) });
    await this.#restore(check, check.adjustment);
    return true;
  }

  /** What the write erased: whatever moved the allowance between its read and its own landing, deposits, returned deposits and other grants alike. */
  async #overwrittenBy({ wallet, write }: AllowanceCheck, tx: IndexedTx): Promise<number> {
    const changes = await this.deploymentAllowanceHistoryRepository.findChanges({
      granter: await this.txManagerService.getFundingWalletAddress(),
      grantee: wallet.address,
      msgTypeUrl: DEPOSIT_GRANT_MSG_TYPE_URL,
      afterHeight: write.readHeight,
      before: tx
    });

    return replayAllowance(write.readLimit, changes, this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM")) - write.readLimit;
  }

  async #restore(check: AllowanceCheck, adjustment: number): Promise<void> {
    if (adjustment === 0) return;

    if (check.round >= MAX_FOLLOW_UP_WRITES) {
      this.#logger.error({ event: "DEPLOYMENT_ALLOWANCE_FOLLOW_UPS_EXHAUSTED", ...this.#describe(check), adjustment });
      return;
    }

    const { previousLimit, nextLimit } = await this.deploymentAllowanceService.adjust(check.wallet, adjustment, { round: check.round + 1, redo: true });
    const shortfall = Math.max(0, -(previousLimit + adjustment));

    this.#logger.info({ event: "DEPLOYMENT_ALLOWANCE_RESTORED", ...this.#describe(check), adjustment, previousLimit, nextLimit, shortfall });
  }

  async #checkAgain(check: AllowanceCheck): Promise<void> {
    if (check.attempt >= MAX_CHECK_ATTEMPTS) {
      this.#logger.error({ event: "DEPLOYMENT_ALLOWANCE_CHECK_GAVE_UP", ...this.#describe(check) });
      return;
    }

    await this.deploymentAllowanceService.scheduleCheck({ ...check, attempt: check.attempt + 1 });
  }

  #isPastLanding({ write }: AllowanceCheck, latestBlockTime: Date | undefined): boolean {
    const landingDeadline = addMinutes(
      addMilliseconds(new Date(write.sentAt), this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")),
      LANDING_MARGIN_IN_MIN
    );

    return !!latestBlockTime && latestBlockTime > landingDeadline;
  }

  #describe({ wallet, write, round, attempt }: AllowanceCheck) {
    return { address: wallet.address, txHash: write.txHash, readHeight: write.readHeight, round, attempt };
  }
}
