import { PromisePool } from "@supercharge/promise-pool";
import assert from "http-assert";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { organizationAnalyticsProperties } from "@src/billing/lib/organization-analytics/organization-analytics";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type StripeTransactionType, type UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import type { AllowanceAdjustment } from "@src/billing/services/deployment-allowance/deployment-allowance.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { ManagedUserWalletService } from "@src/billing/services/managed-user-wallet/managed-user-wallet.service";
import { type PaymentCredit, PaymentCreditService } from "@src/billing/services/payment-credit/payment-credit.service";
import type { AllowanceWallet } from "@src/billing/services/reconcile-deployment-allowance/reconcile-deployment-allowance.job";
import { type RefundDebit, RefundDebitService } from "@src/billing/services/refund-debit/refund-debit.service";
import { WalletInitializerService } from "@src/billing/services/wallet-initializer/wallet-initializer.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";

export const ORGANIZATION_DELETED_ERROR_CODE = "organization_deleted";

export interface PaymentAnalyticsContext {
  currency?: string;
  cardBrand?: string;
  paymentMethodType?: string;
  transactionId?: string;
  source?: StripeTransactionType;
  isAutoRecharge?: boolean;
  /** First-purchase bonus included in the topped-up amount, in cents. */
  bonusAmountCents?: number;
}

/** The payment a top-up credits; its transaction keys the credit, so a retried settlement never grants it twice. */
export type CreditedPayment = PaymentAnalyticsContext & { transactionId: string };

/** The payment a refund debits; its transaction and refunded totals key the debit, so a retried refund never debits it twice. */
export type RefundedPayment = Pick<PaymentAnalyticsContext, "currency"> & Pick<RefundDebit, "transactionId" | "refundedBefore" | "refundedAfter">;

/** Who a credit or a debit is for: the member who acted, if their account still exists, and the organization that paid. */
export interface WalletPayer {
  userId: string | null;
  organizationId?: string | null;
  /** Set only for a payment whose Stripe customer and transaction row both name this team; any other payment funds the user's own wallet. */
  team?: Pick<OrganizationOutput, "id" | "type">;
}

export const CREDIT_IN_FLIGHT_ERROR_CODE = "credit_in_flight";

/** Identifiers of the wallet a top-up credited, so callers can fund its draining deployments once the credit has committed. */
export interface ToppedUpWallet {
  walletId: number;
  address: string;
}

@singleton()
export class RefillService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedUserWalletService: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly balancesService: BalancesService,
    private readonly paymentCreditService: PaymentCreditService,
    private readonly refundDebitService: RefundDebitService,
    private readonly walletInitializerService: WalletInitializerService,
    private readonly analyticsService: AnalyticsService,
    private readonly organizationRepository: OrganizationRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: RefillService.name });
  }

  async refillAllFees() {
    const wallets = await this.userWalletRepository.findDrainingWallets({
      fee: this.config.FEE_ALLOWANCE_REFILL_THRESHOLD,
      trialExpirationDays: this.config.TRIAL_ALLOWANCE_EXPIRATION_DAYS
    });

    if (wallets.length) {
      const { errors } = await PromisePool.withConcurrency(this.config.ALLOWANCE_REFILL_BATCH_SIZE)
        .for(wallets)
        .process(async wallet => this.refillWalletFees(wallet));

      if (errors.length) {
        this.logger.error({ event: "WALLETS_REFILL_ERROR", error: new AggregateError(errors) });
      }
    }
  }

  private async refillWalletFees(userWallet: UserWalletOutput) {
    await this.managedUserWalletService.refillWalletFees(this.managedSignerService, userWallet);
    await this.balancesService.refreshUserWalletLimits(userWallet);
  }

  /**
   * Top up the wallet with the given amount in USD
   * @param amountUsd - The amount in USD *cents* to top up the wallet with (e.g. 10000 = $100)
   * @param payer - The member who paid and the organization paying, read off the transaction
   * @param options.payment - The payment credited, whose remaining context is attached to the `balance_top_up` analytics event
   * @returns The credited wallet's identifiers, so the caller can fund its draining deployments after the credit commits.
   */
  async topUpWallet(amountUsd: number, payer: WalletPayer, options: { endTrial?: boolean; payment: CreditedPayment }): Promise<ToppedUpWallet> {
    const { userId } = payer;
    const userWallet = await this.lockActivatedWallet(payer);

    await this.#grantCreditAndFees({
      transactionId: options.payment.transactionId,
      wallet: { id: userWallet.id, address: userWallet.address! },
      amountCents: amountUsd,
      bonusCents: options.payment.bonusAmountCents ?? 0
    });

    await this.balancesService.refreshUserWalletLimits(userWallet, { endTrial: options.endTrial ?? true });
    await this.clearAbuseLockOnPayment(userWallet, userId);

    this.#trackFor(userId, "balance_top_up", {
      amount_cents: amountUsd,
      amount_usd: amountUsd / 100,
      currency: options.payment.currency,
      card_brand: options.payment.cardBrand,
      payment_method_type: options.payment.paymentMethodType,
      transaction_id: options.payment.transactionId,
      source: options.payment.source,
      auto_recharge: options.payment.isAutoRecharge,
      bonus_amount_cents: options.payment.bonusAmountCents,
      ...this.#organizationPropertiesOf(payer)
    });
    this.logger.debug({ event: "WALLET_TOP_UP", userWallet, amountUsd });

    return { walletId: userWallet.id, address: userWallet.address! };
  }

  /** Waits for both grants before failing, so the settlement never rolls back while its credit is still being granted. */
  async #grantCreditAndFees(credit: PaymentCredit): Promise<void> {
    const outcomes = await Promise.allSettled([
      this.paymentCreditService.creditOnce(credit),
      this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
        address: credit.wallet.address,
        derivationIndex: credit.wallet.id,
        limits: { fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT }
      })
    ]);
    const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");

    if (failure) throw failure.reason;
  }

  /**
   * Reduce the wallet balance (e.g., for refunds)
   * @param amountUsd - The amount in USD *cents* to reduce from the wallet (e.g. 10000 = $100)
   * @param payer - The member who paid and the organization that paid, read off the transaction
   * @param refund - The refunded payment, which keys the debit and is attached to the `balance_refund` analytics event
   */
  async reduceWalletBalance(amountUsd: number, payer: WalletPayer, refund: RefundedPayment) {
    const { userId } = payer;
    const userWallet = payer.team
      ? await this.userWalletRepository.findOneByOrganizationId(payer.team.id)
      : await this.userWalletRepository.findOneBy({ userId: this.#ownWalletUserIdOf(payer) });

    if (!userWallet || !userWallet.address) {
      this.logger.warn({ event: "WALLET_REDUCE_NO_WALLET", userId });
      return;
    }

    await this.#assertNoCreditInFlight(userWallet.address);
    const debit = await this.#debitAndRefillFees({ id: userWallet.id, address: userWallet.address }, amountUsd, refund);

    await this.balancesService.refreshUserWalletLimits(userWallet);
    this.#trackFor(userId, "balance_refund", {
      amount_cents: amountUsd,
      amount_usd: amountUsd / 100,
      currency: refund.currency,
      transaction_id: refund.transactionId,
      ...this.#organizationPropertiesOf(payer)
    });
    this.logger.info({ event: "WALLET_BALANCE_REDUCED", userId, amountUsd, previousLimit: debit?.previousLimit, nextLimit: debit?.nextLimit });
  }

  /** A credit still landing read the allowance before this debit could, so whichever grant landed second would overwrite the other; the refund is redelivered once the credit lands. */
  async #assertNoCreditInFlight(address: string): Promise<void> {
    if (!(await this.paymentCreditService.isCreditInFlight(address))) return;

    this.logger.warn({ event: "WALLET_REDUCE_CREDIT_IN_FLIGHT", address });
    throw createError(409, "A credit to this wallet is still landing, so the refund is applied once it has", { errorCode: CREDIT_IN_FLIGHT_ERROR_CODE });
  }

  /** Waits for both grants before failing, like a credit does, so the refund never rolls back while its debit is still being granted. */
  async #debitAndRefillFees(wallet: AllowanceWallet, amountCents: number, refund: RefundedPayment): Promise<AllowanceAdjustment | undefined> {
    const { transactionId, refundedBefore, refundedAfter } = refund;
    const [debit, fees] = await Promise.allSettled([
      this.refundDebitService.debitOnce({ transactionId, wallet, refundedBefore, refundedAfter, amountCents }),
      this.managedUserWalletService.authorizeSpending(this.managedSignerService, {
        address: wallet.address,
        derivationIndex: wallet.id,
        limits: { fees: this.config.FEE_ALLOWANCE_REFILL_AMOUNT }
      })
    ]);

    if (debit.status === "rejected") throw debit.reason;
    if (fees.status === "rejected") throw fees.reason;

    return debit.value;
  }

  /** A failed clear is logged instead of thrown, so a lock that cannot be cleared never holds back the settlement of a payment already credited on chain. */
  private async clearAbuseLockOnPayment(userWallet: UserWalletOutput, userId: string | null) {
    try {
      if (!(await this.userWalletRepository.clearAbuseLock(userWallet.id))) return;

      this.logger.info({ event: "WALLET_ABUSE_LOCK_CLEARED", walletId: userWallet.id, userId });
      this.#trackFor(userId, "account_restriction_lifted", { lifted_by: "payment" });
    } catch (error) {
      this.logger.error({ event: "WALLET_ABUSE_LOCK_CLEAR_FAILED", walletId: userWallet.id, userId, error });
    }
  }

  /** Holds the wallet row until the settlement commits, so an abuse wipe or a team deletion of the same wallet waits for it instead of acting between this grant and its bookkeeping. */
  private async lockActivatedWallet(payer: WalletPayer) {
    const userWallet = await this.ensureActivatedWallet(payer);
    const lockedWallet = (await this.userWalletRepository.findOneByAndLock({ id: userWallet.id })) ?? userWallet;

    if (payer.team) await this.#assertTeamNotDeleted(payer.team.id);

    return lockedWallet;
  }

  /** Read once the wallet is locked, which a team deletion also locks, so a payment settling after the deletion is refused rather than credited to nobody. */
  async #assertTeamNotDeleted(organizationId: string): Promise<void> {
    const team = await this.organizationRepository.findById(organizationId);

    assert(!team?.deletedAt, 409, "The team organization was deleted, so its wallet takes no more credits", { errorCode: ORGANIZATION_DELETED_ERROR_CODE });
  }

  /**
   * Returns the user's wallet, creating and activating it as needed —
   * funding with real money must activate a wallet even when the user never started a trial.
   * The activation claim no-ops for already-activated wallets.
   */
  private async ensureActivatedWallet(payer: WalletPayer) {
    const userWallet = payer.team
      ? await this.walletInitializerService.ensureTeamWallet(payer.team, payer.userId)
      : await this.walletInitializerService.ensureWallet(this.#ownWalletUserIdOf(payer));

    return (await this.userWalletRepository.claimActivation(userWallet.id)) ?? userWallet;
  }

  #organizationPropertiesOf(payer: WalletPayer) {
    return organizationAnalyticsProperties({ id: payer.organizationId, type: payer.team ? "team" : "personal" });
  }

  /** Analytics follow a person, so a payment whose member has deleted their account is left out of them. */
  #trackFor(userId: string | null, eventName: Parameters<AnalyticsService["track"]>[1], eventProperties: Record<string, unknown>) {
    if (userId) this.analyticsService.track(userId, eventName, eventProperties);
  }

  /** Only a member who still exists has a wallet of their own, so a payment no member made funds a team or nothing. */
  #ownWalletUserIdOf(payer: WalletPayer): string {
    assert(payer.userId, 500, "A payment no member made can only fund a team organization's wallet", { organizationId: payer.organizationId });

    return payer.userId;
  }
}
