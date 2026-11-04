import { addMilliseconds, addMinutes, isAfter } from "date-fns";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type PaymentCreditOutput, PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { DeploymentAllowanceService } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { isUnknownTxOutcome } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { TxPresenceService } from "@src/chain/services/tx-presence/tx-presence.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { COSMOS_TX_CODE_OK } from "@src/utils/constants";

export const PAYMENT_CREDIT_UNDECIDED_ERROR_CODE = "payment_credit_undecided";

/** Past the signer's request timeout an unordered grant can no longer land; the margin is for a chain endpoint that has not caught up yet. */
const LANDING_MARGIN_IN_MIN = 10;

type CreditOutcome = "landed" | "not_landed" | "undecided";

export interface PaymentCredit {
  transactionId: string;
  wallet: { id: number; address: string };
  /** The first-purchase bonus included. */
  amountCents: number;
  bonusCents: number;
}

/** Raises a wallet's deployment allowance by a settled payment once, however often its settlement is retried. */
@singleton()
export class PaymentCreditService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly paymentCreditRepository: PaymentCreditRepository,
    private readonly balancesService: BalancesService,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly txPresenceService: TxPresenceService,
    private readonly billingConfigService: BillingConfigService,
    private readonly deploymentAllowanceService: DeploymentAllowanceService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: PaymentCreditService.name });
  }

  /** The credit is recorded pending before the allowance is read, so a refund debit of the same wallet waits for it rather than reading under it. */
  async creditOnce({ transactionId, wallet, amountCents, bonusCents }: PaymentCredit): Promise<void> {
    if (await this.hasLanded(transactionId)) {
      this.logger.info({ event: "PAYMENT_CREDIT_ALREADY_LANDED", transactionId });
      return;
    }

    await this.paymentCreditRepository.createPending({ transactionId, address: wallet.address, amount: amountCents, bonusAmount: bonusCents });
    const read = await this.#readLimit(transactionId, wallet);
    const tx = await this.#grant(transactionId, wallet, read, read.limit + amountCents * 10000);

    if (tx && tx.code !== COSMOS_TX_CODE_OK) {
      await this.paymentCreditRepository.deletePending(transactionId);
      throw createError(502, "The chain refused the credit grant", { txHash: tx.hash });
    }

    await this.paymentCreditRepository.markLanded(transactionId, tx?.hash);
  }

  /** Whether a credit of this wallet may still be landing, so its grant could overwrite a debit read alongside it. */
  async isCreditInFlight(address: string): Promise<boolean> {
    const pending = await this.paymentCreditRepository.findPendingByAddress(address);

    return pending.some(({ createdAt }) => !isAfter(new Date(), this.#landingDeadlineOf(createdAt)));
  }

  async #readLimit(transactionId: string, wallet: PaymentCredit["wallet"]) {
    try {
      return await this.balancesService.retrieveDeploymentLimitAtLatestHeight(wallet);
    } catch (error) {
      await this.paymentCreditRepository.deletePending(transactionId);
      throw error;
    }
  }

  /** Only a failure that proves nothing landed releases the credit for another attempt; one the signer could not decide keeps it pending. */
  async #grant(transactionId: string, wallet: PaymentCredit["wallet"], read: { limit: number; height: number }, limit: number) {
    const sentAt = new Date().toISOString();
    const watch = (txHash: string) => this.deploymentAllowanceService.watch(wallet, { txHash, readHeight: read.height, readLimit: read.limit, sentAt });

    try {
      const tx = await this.managedUserWalletService.authorizeDeploymentSpendingOnly(this.managedSignerService, {
        address: wallet.address,
        derivationIndex: wallet.id,
        limit
      });

      if (tx?.code === COSMOS_TX_CODE_OK) await watch(tx.hash);

      return tx;
    } catch (error) {
      if (!isUnknownTxOutcome(error)) {
        await this.paymentCreditRepository.deletePending(transactionId);
      } else if (error.txHash) {
        await this.paymentCreditRepository.attachTxHash(transactionId, error.txHash);
        await watch(error.txHash);
      }

      throw error;
    }
  }

  /** Settles a credit an earlier attempt left pending by its hash, and refuses to answer while that credit may still land. */
  async hasLanded(transactionId: string): Promise<boolean> {
    const credit = await this.paymentCreditRepository.findByTransactionId(transactionId);

    if (!credit) return false;
    if (credit.status === "landed") return true;

    const outcome = await this.#outcomeOf(credit);

    if (outcome === "landed") {
      await this.paymentCreditRepository.markLanded(transactionId, credit.txHash);
      return true;
    }

    if (outcome === "undecided") {
      this.logger.error({ event: "PAYMENT_CREDIT_UNDECIDED", transactionId, address: credit.address, txHash: credit.txHash, pendingSince: credit.createdAt });
      throw createError(503, "The payment's credit may still be landing, so it is not granted again until its outcome is known", {
        errorCode: PAYMENT_CREDIT_UNDECIDED_ERROR_CODE
      });
    }

    await this.paymentCreditRepository.deletePending(transactionId);
    return false;
  }

  async #outcomeOf({ txHash, createdAt }: PaymentCreditOutput): Promise<CreditOutcome> {
    if (!txHash) return "undecided";

    const tx = await this.txPresenceService.findTx(txHash);

    if (tx) return tx.code === COSMOS_TX_CODE_OK ? "landed" : "not_landed";

    return isAfter(new Date(), this.#landingDeadlineOf(createdAt)) ? "not_landed" : "undecided";
  }

  #landingDeadlineOf(createdAt: Date): Date {
    return addMinutes(addMilliseconds(createdAt, this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")), LANDING_MARGIN_IN_MIN);
  }
}
