import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { totalOf } from "@src/billing/lib/deployment-allowance-replay/deployment-allowance-replay";
import {
  type CompletedFundingWalletMove,
  FundingWalletMoveRepository,
  type FundingWalletRefundOutput,
  FundingWalletRefundRepository,
  FundingWalletRepository,
  UserWalletRepository
} from "@src/billing/repositories";
import { DeploymentAllowanceHistoryRepository } from "@src/billing/repositories/deployment-allowance-history/deployment-allowance-history.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { type CreateLogger, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { CreditReturnedEscrow } from "./credit-returned-escrow.job";

export type ReturnedEscrowCredit = { credited: number; needsReview: number };

type CreditedWallet = { id: number; address: string };

/** Gives a user back the escrow their closing deployments returned to a funding wallet they had already moved off, where no grant was left to take it back. */
@singleton()
export class ReturnedEscrowService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly fundingWalletRepository: FundingWalletRepository,
    private readonly fundingWalletMoveRepository: FundingWalletMoveRepository,
    private readonly fundingWalletRefundRepository: FundingWalletRefundRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly deploymentAllowanceHistoryRepository: DeploymentAllowanceHistoryRepository,
    private readonly deploymentAllowanceService: DeploymentAllowanceService,
    private readonly jobQueueService: JobQueueService,
    private readonly billingConfigService: BillingConfigService,
    private readonly coreConfigService: CoreConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ReturnedEscrowService.name });
  }

  /** Safe to run again at any time: each close message is recorded once and its row decides whether it is still to be credited. */
  async creditTo(userWalletId: number): Promise<ReturnedEscrowCredit> {
    const wallet = await this.userWalletRepository.findById(userWalletId);
    const credit: ReturnedEscrowCredit = { credited: 0, needsReview: 0 };

    if (!wallet?.address) return credit;

    const creditedWallet = { id: wallet.id, address: wallet.address };
    const moves = await this.fundingWalletMoveRepository.findCompletedOf(userWalletId, this.coreConfigService.get("NETWORK"));

    for (const move of moves) {
      await this.#recordReturnedEscrow(move, creditedWallet);

      for (const refund of await this.fundingWalletRefundRepository.findByMove(move.id)) {
        const outcome = await this.#credit(refund, creditedWallet);

        credit.credited += outcome === "credited" ? 1 : 0;
        credit.needsReview += outcome === "needs_review" ? 1 : 0;
      }
    }

    return credit;
  }

  /** For an operator to run before a funding wallet is given up, so a close whose own job was lost is still credited. */
  async queueForEveryoneMovedOff(address: string): Promise<{ queued: number }> {
    const network = this.coreConfigService.get("NETWORK");
    const fundingWallet = await this.fundingWalletRepository.findByAddress(network, address);

    if (!fundingWallet) throw createError(404, `Funding wallet ${address} is not registered`, { network });

    const userWalletIds = await this.fundingWalletMoveRepository.findCompletedUserWalletIds(fundingWallet.id);

    for (const userWalletId of userWalletIds) {
      await this.jobQueueService.enqueue(new CreditReturnedEscrow({ userWalletId }));
    }

    this.#logger.info({ event: "RETURNED_ESCROW_CREDITS_QUEUED", network, address, queued: userWalletIds.length });

    return { queued: userWalletIds.length };
  }

  async #recordReturnedEscrow(move: CompletedFundingWalletMove, wallet: CreditedWallet): Promise<void> {
    const denom = this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM");
    const refunds = await this.deploymentAllowanceHistoryRepository.findRefundsLeftWithGranter({
      granter: move.fromAddress,
      owner: wallet.address,
      afterHeight: move.readHeight
    });

    for (const { txHash, msgIndex, receivedByGranter } of refunds) {
      const amount = totalOf(receivedByGranter, denom);

      if (amount > 0) await this.fundingWalletRefundRepository.recordUnlessKnown({ moveId: move.id, txHash, msgIndex, amount });
    }
  }

  /** Marked as crediting before the grant is sent, so a run that dies in between is never mistaken for one that sent nothing. */
  async #credit(refund: FundingWalletRefundOutput, wallet: CreditedWallet): Promise<"credited" | "needs_review" | "nothing_to_do"> {
    if (refund.status === "credited") return "nothing_to_do";
    if (refund.status === "failed") return "needs_review";
    if (refund.status === "crediting") return await this.#flagForReview(refund, "the credit was interrupted, so it may or may not be on chain");

    const crediting = await this.fundingWalletRefundRepository.updateFrom(refund.id, "pending", { status: "crediting" });

    if (!crediting) return "nothing_to_do";

    try {
      await this.deploymentAllowanceService.adjust(wallet, crediting.amount, { redo: true });
    } catch (error) {
      if (!isUnknownTxOutcome(error)) {
        await this.fundingWalletRefundRepository.updateFrom(crediting.id, "crediting", { status: "pending" });
        throw error;
      }

      if (!error.txHash) return await this.#flagForReview(crediting, "the signer could not tell whether the credit was sent");
    }

    await this.fundingWalletRefundRepository.updateFrom(crediting.id, "crediting", { status: "credited" });
    this.#logger.info({
      event: "RETURNED_ESCROW_CREDITED",
      userWalletId: wallet.id,
      refundId: crediting.id,
      txHash: crediting.txHash,
      amount: crediting.amount
    });

    return "credited";
  }

  async #flagForReview(refund: FundingWalletRefundOutput, failure: string): Promise<"needs_review"> {
    this.#logger.error({ event: "RETURNED_ESCROW_NEEDS_REVIEW", refundId: refund.id, txHash: refund.txHash, amount: refund.amount, failure });
    await this.fundingWalletRefundRepository.updateFrom(refund.id, refund.status, { status: "failed", failure });

    return "needs_review";
  }
}
