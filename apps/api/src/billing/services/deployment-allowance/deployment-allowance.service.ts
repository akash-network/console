import { addSeconds } from "date-fns";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { BalancesService } from "@src/billing/services/balances/balances.service";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import {
  type AllowanceCheck,
  type AllowanceWallet,
  type AllowanceWrite,
  ReconcileDeploymentAllowance
} from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { TxService } from "@src/core/services";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

/** Leaves the chain index time to store the write's block before its check first looks for it. */
export const ALLOWANCE_CHECK_DELAY_IN_SECONDS = 60;

export type AllowanceAdjustment = { previousLimit: number; nextLimit: number; txHash?: string };

/** Changes a wallet's deployment allowance and has every grant checked for what it overwrote, since the chain only lets a grant set an absolute value. */
@singleton()
export class DeploymentAllowanceService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly balancesService: BalancesService,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: DeploymentAllowanceService.name });
  }

  /** A write the chain may still land is watched by its hash before the error reaches the caller; `redo` writes it again if it never lands, for a caller that does not retry it itself. */
  async adjust(wallet: AllowanceWallet, delta: number, { round = 0, redo = false } = {}): Promise<AllowanceAdjustment> {
    const read = await this.balancesService.retrieveDeploymentLimitAtLatestHeight(wallet);
    const nextLimit = Math.max(0, read.limit + delta);
    const sentAt = new Date().toISOString();
    const watchFor = (txHash: string) =>
      this.scheduleCheck({
        wallet,
        write: { txHash, readHeight: read.height, readLimit: read.limit, sentAt },
        adjustment: redo ? delta : 0,
        round,
        attempt: 0
      });

    try {
      const tx = await this.managedUserWalletService.authorizeDeploymentSpendingOnly(this.managedSignerService, {
        address: wallet.address,
        derivationIndex: wallet.id,
        limit: nextLimit
      });

      if (tx && tx.code !== COSMOS_TX_CODE_OK) throw createError(502, "The chain refused the deployment allowance grant", { txHash: tx.hash });
      if (tx) await watchFor(tx.hash);

      return { previousLimit: read.limit, nextLimit, txHash: tx?.hash };
    } catch (error) {
      if (isUnknownTxOutcome(error) && error.txHash) await watchFor(error.txHash);
      throw error;
    }
  }

  /** For a grant its caller made itself; a failure to watch it is logged rather than thrown, since the grant has already landed. */
  async watch(wallet: AllowanceWallet, write: AllowanceWrite): Promise<void> {
    await this.scheduleCheck({ wallet, write, adjustment: 0, round: 0, attempt: 0 });
  }

  /** Recorded outside the caller's transaction, because the grant it checks stays on chain when that transaction rolls back. */
  async scheduleCheck(check: AllowanceCheck): Promise<void> {
    try {
      await this.txService.outsideTransaction(() =>
        this.jobQueueService.enqueue(new ReconcileDeploymentAllowance(check), {
          singletonKey: `${ReconcileDeploymentAllowance[JOB_NAME]}.${check.write.txHash}.${check.attempt}`,
          startAfter: addSeconds(new Date(), ALLOWANCE_CHECK_DELAY_IN_SECONDS).toISOString()
        })
      );
    } catch (error) {
      this.#logger.error({ event: "DEPLOYMENT_ALLOWANCE_CHECK_SCHEDULE_FAILED", address: check.wallet.address, txHash: check.write.txHash, error });
    }
  }
}
