import { addMilliseconds, addMinutes, isAfter } from "date-fns";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type RefundDebitOutput, RefundDebitRepository } from "@src/billing/repositories/refund-debit/refund-debit.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type AllowanceAdjustment, DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

export const REFUND_DEBIT_UNDECIDED_ERROR_CODE = "refund_debit_undecided";

/** Past the signer's request timeout an unordered grant can no longer land; the margin is for a chain endpoint that has not caught up yet. */
const LANDING_MARGIN_IN_MIN = 10;

type DebitOutcome = "landed" | "not_landed" | "undecided";

export interface RefundDebit {
  transactionId: string;
  wallet: { id: number; address: string };
  /** The charge's refunded total in cents as the payment's row recorded it before this refund. */
  refundedBefore: number;
  /** The charge's refunded total in cents once this refund applies. */
  refundedAfter: number;
  /** The first-purchase bonus clawback included. */
  amountCents: number;
}

/** Lowers a wallet's deployment allowance by a refund once, however often its delivery is retried. */
@singleton()
export class RefundDebitService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly refundDebitRepository: RefundDebitRepository,
    private readonly deploymentAllowanceService: DeploymentAllowanceService,
    private readonly txPresenceService: TxPresenceService,
    private readonly billingConfigService: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: RefundDebitService.name });
  }

  /** Counts what earlier deliveries already debited and the payment's row never recorded, so a refund that failed after its debit landed is finished rather than debited again. */
  async debitOnce({ transactionId, wallet, refundedBefore, refundedAfter, amountCents }: RefundDebit): Promise<AllowanceAdjustment | undefined> {
    const debitedThrough = await this.#debitedThrough(transactionId, refundedBefore);

    if (debitedThrough >= refundedAfter) {
      this.#logger.info({ event: "REFUND_DEBIT_ALREADY_LANDED", transactionId, amountRefunded: refundedAfter, debitedThrough });
      return undefined;
    }

    const key = { transactionId, amountRefunded: refundedAfter };
    const amount = amountCents - (debitedThrough - refundedBefore);
    await this.refundDebitRepository.createPending({ ...key, address: wallet.address, amount });

    try {
      const adjustment = await this.deploymentAllowanceService.adjust(wallet, -amount * 10000);
      await this.refundDebitRepository.markLanded(key, adjustment.txHash);

      return adjustment;
    } catch (error) {
      if (!isUnknownTxOutcome(error)) {
        await this.refundDebitRepository.deletePending(key);
      } else if (error.txHash) {
        await this.refundDebitRepository.attachTxHash(key, error.txHash);
      }

      throw error;
    }
  }

  async #debitedThrough(transactionId: string, refundedBefore: number): Promise<number> {
    const debits = await this.refundDebitRepository.findRefundedBeyond(transactionId, refundedBefore);
    let debitedThrough = refundedBefore;

    for (const debit of debits) {
      if (await this.#hasLanded(debit)) debitedThrough = Math.max(debitedThrough, debit.amountRefunded);
    }

    return debitedThrough;
  }

  /** Settles a debit an earlier delivery left pending by its hash, and refuses to answer while that debit may still land. */
  async #hasLanded(debit: RefundDebitOutput): Promise<boolean> {
    if (debit.status === "landed") return true;

    const outcome = await this.#outcomeOf(debit);

    if (outcome === "landed") {
      await this.refundDebitRepository.markLanded(debit, debit.txHash);
      return true;
    }

    if (outcome === "undecided") {
      this.#logger.error({
        event: "REFUND_DEBIT_UNDECIDED",
        transactionId: debit.transactionId,
        amountRefunded: debit.amountRefunded,
        address: debit.address,
        txHash: debit.txHash,
        pendingSince: debit.createdAt
      });
      throw createError(503, "The refund's debit may still be landing, so it is not debited again until its outcome is known", {
        errorCode: REFUND_DEBIT_UNDECIDED_ERROR_CODE
      });
    }

    await this.refundDebitRepository.deletePending(debit);
    return false;
  }

  async #outcomeOf({ txHash, createdAt }: RefundDebitOutput): Promise<DebitOutcome> {
    if (!txHash) return "undecided";

    const tx = await this.txPresenceService.findTx(txHash);

    if (tx) return tx.code === COSMOS_TX_CODE_OK ? "landed" : "not_landed";

    const landingDeadline = addMinutes(addMilliseconds(createdAt, this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")), LANDING_MARGIN_IN_MIN);

    return isAfter(new Date(), landingDeadline) ? "not_landed" : "undecided";
  }
}
