import type { LoggerService } from "@akashnetwork/logging";
import { ConstantBackoff, handleWhenResult, retry, TaskCancelledError, timeout, TimeoutStrategy, wrap } from "cockatiel";
import assert from "http-assert";
import createError from "http-errors";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { FundDrainingDeploymentsCommand } from "@src/billing/commands/fund-draining-deployments.command";
import { PaymentIntentResult } from "@src/billing/http-schemas/stripe.schema";
import { CARD_DECLINED_ERROR_CODE } from "@src/billing/lib/card-decline/card-decline";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import {
  SETTLED_TRANSACTION_STATUSES,
  StripeTransactionInput,
  StripeTransactionOutput,
  StripeTransactionRepository,
  TRIAL_PRESERVING_TRANSACTION_TYPES
} from "@src/billing/repositories";
import { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { RefillService, type ToppedUpWallet } from "@src/billing/services/refill/refill.service";
import { STRIPE_CURRENCY } from "@src/billing/services/stripe/stripe.service";
import { IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE, PAYMENT_IN_PROGRESS_ERROR_MESSAGE } from "@src/billing/services/stripe-error/stripe-error.service";
import { type CreateLogger, LOGGER_FACTORY, WithTransaction } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { TimerService } from "@src/core/services/timer/timer.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";

/**
 * A granted first-purchase bonus that the webhook dispatcher turns into a {@link FirstPurchaseBonusGranted}
 * domain event once the settling transaction has committed. Returned only when a bonus was actually granted.
 */
export interface FirstPurchaseBonusGrant {
  userId: string;
  bonusAmountCents: number;
  paidAmountCents: number;
}

/**
 * Marks a Stripe PaymentIntent created by the automatic wallet-balance reload job. The settlement path
 * reads it to tell an automatic recharge from a manual "Add Funds" charge so only automatic ones notify.
 */
export const AUTO_RECHARGE_METADATA_KEY = "auto_recharge";

const CARD_DECLINED_MESSAGE = "Payment method was declined. Please try a different card.";

/** Without both, an issuer that wants 3DS leaves the intent stalled in requires_action instead of declining it. */
const OFF_SESSION_CHARGE_OPTIONS = { off_session: true, error_on_requires_action: true } as const satisfies Pick<
  Stripe.PaymentIntentCreateParams,
  "off_session" | "error_on_requires_action"
>;

/** The decline code lets the reload job tell a card it can retry from one the issuer will never approve. */
function declineCodeOf(paymentIntent: Stripe.PaymentIntent): { declineCode?: string } {
  const declineCode = paymentIntent.last_payment_error?.decline_code;
  return declineCode ? { declineCode } : {};
}

/**
 * A settled automatic recharge that the webhook dispatcher turns into an {@link AutoRechargeSucceeded} domain
 * event once the settling transaction has committed. Present only when a real charge was credited on this
 * delivery, so retries and replays never notify twice.
 */
export interface AutoRechargeSuccess {
  userId: string;
  transactionId: string;
  amountCents: number;
}

/**
 * What a webhook settlement produced, for the dispatcher to publish after the transaction commits.
 * Either field is absent when its event should not fire.
 */
export interface SettlementOutcome {
  bonusGrant?: FirstPurchaseBonusGrant;
  autoRecharge?: AutoRechargeSuccess;
}

/**
 * How a reused idempotency key should react when the requested amount differs from the amount
 * recorded on its transaction row. `reject` treats it as a definitive client error; `tolerate`
 * proceeds with the recorded amount.
 */
export type OnAmountMismatch = "reject" | "tolerate";

@singleton()
export class StripeTransactionService {
  /**
   * Statuses that should be applied later via Stripe webhooks. Both map to transaction status
   * "succeeded", and writing that from the request path would make the webhook's
   * `status !== "succeeded"` guard skip crediting the wallet: the customer would be charged
   * without ever receiving credits.
   */
  readonly #DEFERRED_STATUSES = new Set<Stripe.PaymentIntent.Status>(["succeeded", "requires_capture"]);

  private static readonly TERMINAL_TRANSACTION_STATUSES: Set<StripeTransactionOutput["status"]> = new Set(["succeeded", "failed", "refunded", "canceled"]);

  private readonly loggerService: LoggerService;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly refillService: RefillService,
    private readonly firstPurchaseBonusService: FirstPurchaseBonusService,
    private readonly timerService: TimerService,
    private readonly userRepository: UserRepository,
    private readonly domainEventsService: DomainEventsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: StripeTransactionService.name });
  }

  async createPaymentIntent(params: {
    userId: string;
    customer: string;
    payment_method: string;
    amount: number;
    confirm: boolean;
    offSession?: boolean;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
    onAmountMismatch: OnAmountMismatch;
  }): Promise<PaymentIntentResult> {
    const amountInCents = Math.round(params.amount * 100);

    if (!params.idempotencyKey) {
      const transaction = await this.stripeTransactionRepository.create({
        userId: params.userId,
        type: "payment_intent",
        status: "created",
        amount: amountInCents,
        currency: STRIPE_CURRENCY
      });

      return await this.#chargePaymentIntent(transaction, params);
    }

    const { transaction, isNew } = await this.stripeTransactionRepository.findOrCreateByIdempotencyKey({
      userId: params.userId,
      type: "payment_intent",
      status: "created",
      amount: amountInCents,
      currency: STRIPE_CURRENCY,
      stripeIdempotencyKey: params.idempotencyKey
    });

    if (isNew) {
      return await this.#chargePaymentIntent(transaction, params);
    }

    this.loggerService.info({
      event: "PAYMENT_INTENT_KEY_REUSED",
      transactionId: transaction.id,
      status: transaction.status,
      hasPaymentIntent: !!transaction.stripePaymentIntentId
    });

    this.#ensureReusedKeyAmountConsistency(transaction, amountInCents, params.onAmountMismatch);

    if (SETTLED_TRANSACTION_STATUSES.has(transaction.status)) {
      this.loggerService.info({
        event: "PAYMENT_INTENT_REPLAY_SHORT_CIRCUIT",
        transactionId: transaction.id,
        status: transaction.status
      });

      return {
        success: true,
        paymentIntentId: transaction.stripePaymentIntentId ?? undefined,
        transactionId: transaction.id,
        transactionStatus: transaction.status
      };
    }

    if (transaction.stripePaymentIntentId) {
      return await this.#resumeFromRecordedPaymentIntent(transaction, transaction.stripePaymentIntentId);
    }

    return await this.#chargePaymentIntent(transaction, params);
  }

  /**
   * A row that already records a PaymentIntent must never create a second one: the live intent is
   * retrieved and its current status drives the outcome. This keeps a replayed delivery from
   * downgrading row state with a stale response, re-opening 3DS on a dead intent, or creating an
   * extra charge after Stripe prunes the key (replays are only guaranteed for 24 hours).
   */
  async #resumeFromRecordedPaymentIntent(transaction: StripeTransactionOutput, stripePaymentIntentId: string): Promise<PaymentIntentResult> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(stripePaymentIntentId);

    switch (paymentIntent.status) {
      case "succeeded":
      case "requires_capture":
      case "processing": {
        const update: Partial<Pick<StripeTransactionInput, "status">> = {};

        if (!this.#DEFERRED_STATUSES.has(paymentIntent.status)) {
          update.status = this.mapPaymentIntentStatusToTransactionStatus(paymentIntent.status);
        }

        if (update.status) {
          const updated = await this.stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, update);

          if (!updated) {
            const settled = await this.#resultFromSettledWinner(transaction.id, paymentIntent.id);
            if (settled) return settled;
          }
        }

        return {
          success: true,
          paymentIntentId: paymentIntent.id,
          transactionId: transaction.id,
          transactionStatus: update.status ?? transaction.status
        };
      }

      case "requires_action":
      case "requires_confirmation":
        return {
          success: false,
          paymentIntentId: paymentIntent.id,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret || undefined,
          transactionId: transaction.id,
          transactionStatus: transaction.status
        };

      default: {
        const message = paymentIntent.last_payment_error?.message ?? transaction.errorMessage ?? CARD_DECLINED_MESSAGE;

        const updated = await this.stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, {
          status: this.mapPaymentIntentStatusToTransactionStatus(paymentIntent.status),
          errorMessage: message
        });

        if (!updated) {
          const settled = await this.#resultFromSettledWinner(transaction.id, paymentIntent.id);
          if (settled) return settled;
        }

        throw createError(402, message, {
          errorCode: CARD_DECLINED_ERROR_CODE,
          errorType: "payment_error",
          ...declineCodeOf(paymentIntent)
        });
      }
    }
  }

  /**
   * A reused key must request the amount recorded on its row so a replay can never report success
   * for a different amount than was charged. Callers pass their policy: user-initiated top-ups
   * reject a changed amount as a definitive mismatch (the client rotates its key whenever the
   * amount changes, so a changed amount means a stale or misbehaving client); the wallet-reload job
   * tolerates it (it recomputes a live amount on every redelivery of the same job id) and the flow
   * proceeds with the recorded amount.
   */
  #ensureReusedKeyAmountConsistency(transaction: StripeTransactionOutput, requestedAmountInCents: number, onAmountMismatch: OnAmountMismatch): void {
    if (transaction.amount === requestedAmountInCents) {
      return;
    }

    this.loggerService.warn({
      event: "PAYMENT_INTENT_KEY_AMOUNT_MISMATCH",
      transactionId: transaction.id,
      recordedAmount: transaction.amount,
      requestedAmount: requestedAmountInCents,
      onAmountMismatch
    });

    if (onAmountMismatch === "reject") {
      throw new Error(IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE);
    }
  }

  /**
   * When updateByIdUnlessSettled() suppresses a write, a webhook settled the row mid-request and its
   * outcome is authoritative. Responding from the request's now-stale view would report a credited
   * payment as still pending (or as a failure), so the settled row drives the response instead.
   */
  async #resultFromSettledWinner(transactionId: string, fallbackPaymentIntentId?: string): Promise<PaymentIntentResult | undefined> {
    const winner = await this.stripeTransactionRepository.findById(transactionId);

    if (!winner || !SETTLED_TRANSACTION_STATUSES.has(winner.status)) {
      return undefined;
    }

    this.loggerService.info({
      event: "PAYMENT_INTENT_SETTLED_MID_REQUEST",
      transactionId,
      status: winner.status
    });

    return {
      success: true,
      paymentIntentId: winner.stripePaymentIntentId ?? fallbackPaymentIntentId,
      transactionId: winner.id,
      transactionStatus: winner.status
    };
  }

  async #chargePaymentIntent(
    transaction: StripeTransactionOutput,
    params: { customer: string; payment_method: string; confirm: boolean; offSession?: boolean; metadata?: Record<string, string>; idempotencyKey?: string }
  ): Promise<PaymentIntentResult> {
    const createOptions: Parameters<Stripe["paymentIntents"]["create"]> = [
      {
        customer: params.customer,
        payment_method: params.payment_method,
        amount: transaction.amount,
        currency: STRIPE_CURRENCY,
        confirm: params.confirm,
        ...(params.offSession && OFF_SESSION_CHARGE_OPTIONS),
        metadata: {
          ...params.metadata,
          internal_transaction_id: transaction.id
        },
        payment_method_types: ["card", "link"]
      }
    ];

    if (params.idempotencyKey) {
      createOptions.push({ idempotencyKey: params.idempotencyKey });
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(...createOptions);
      const update: Partial<Pick<StripeTransactionInput, "stripePaymentIntentId" | "status">> = { stripePaymentIntentId: paymentIntent.id };

      if (!this.#DEFERRED_STATUSES.has(paymentIntent.status)) {
        update.status = this.mapPaymentIntentStatusToTransactionStatus(paymentIntent.status);
      }

      const updated = await this.stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, update);

      if (!updated) {
        const settled = await this.#resultFromSettledWinner(transaction.id, paymentIntent.id);
        if (settled) return settled;
      }

      const transactionStatus = update.status ?? transaction.status;

      switch (paymentIntent.status) {
        case "succeeded":
        case "requires_capture":
          return { success: true, paymentIntentId: paymentIntent.id, transactionId: transaction.id, transactionStatus };

        case "requires_action":
          return {
            success: false,
            paymentIntentId: paymentIntent.id,
            requiresAction: true,
            clientSecret: paymentIntent.client_secret || undefined,
            transactionId: transaction.id,
            transactionStatus
          };

        case "requires_payment_method":
          throw createError(402, CARD_DECLINED_MESSAGE, {
            errorCode: CARD_DECLINED_ERROR_CODE,
            errorType: "payment_error",
            ...declineCodeOf(paymentIntent)
          });

        default:
          throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError && error.code === "idempotency_key_in_use") {
        this.loggerService.warn({ event: "PAYMENT_INTENT_KEY_IN_USE", transactionId: transaction.id });
        throw new Error(PAYMENT_IN_PROGRESS_ERROR_MESSAGE, { cause: error });
      }

      if (error instanceof Stripe.errors.StripeIdempotencyError) {
        throw error;
      }

      let paymentIntentId: string | undefined;
      if (error instanceof Stripe.errors.StripeError && error.raw) {
        const rawError = error.raw as { payment_intent?: Stripe.PaymentIntent };
        paymentIntentId = rawError.payment_intent?.id;
      }

      const updated = await this.stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        stripePaymentIntentId: paymentIntentId
      });

      if (!updated) {
        const settled = await this.#resultFromSettledWinner(transaction.id, paymentIntentId);
        if (settled) return settled;
      }

      throw error;
    }
  }

  /** Best-effort: a refused cancel is logged so the authentication decline the caller is recording still lands. */
  async cancelUnauthenticatedPaymentIntent(paymentIntentId: string): Promise<void> {
    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId, { cancellation_reason: "abandoned" });
      await this.stripeTransactionRepository.updateByPaymentIntentId(paymentIntentId, { status: "canceled" });
    } catch (error) {
      this.loggerService.error({ event: "PAYMENT_INTENT_CANCEL_FAILED", paymentIntentId, error });
    }
  }

  private mapPaymentIntentStatusToTransactionStatus(
    status: Stripe.PaymentIntent.Status
  ): "created" | "pending" | "requires_action" | "succeeded" | "failed" | "refunded" | "canceled" {
    switch (status) {
      case "succeeded":
        return "succeeded";
      case "requires_capture":
        return "succeeded";
      case "requires_action":
      case "requires_confirmation":
        return "requires_action";
      case "requires_payment_method":
        return "failed";
      case "canceled":
        return "canceled";
      case "processing":
        return "pending";
      default:
        return "pending";
    }
  }

  private readonly resolveTransactionExecutor = wrap(
    timeout(60_000, TimeoutStrategy.Aggressive),
    retry(
      handleWhenResult(result => !StripeTransactionService.TERMINAL_TRANSACTION_STATUSES.has((result as StripeTransactionOutput).status)),
      {
        maxAttempts: Infinity,
        backoff: new ConstantBackoff(500)
      }
    )
  );

  async resolveTransaction(transactionId: string): Promise<StripeTransactionOutput> {
    await this.timerService.delay(4_000);

    let lastTransaction: StripeTransactionOutput | undefined;

    try {
      lastTransaction = await this.resolveTransactionExecutor.execute(async () => {
        const transaction = await this.stripeTransactionRepository.findById(transactionId);

        assert(transaction, 404, "Transaction not found");

        lastTransaction = transaction;

        return transaction;
      });
    } catch (error) {
      if (!(error instanceof TaskCancelledError)) {
        throw error;
      }
    }

    assert(lastTransaction, 404, "Transaction not found");

    return lastTransaction;
  }

  @WithTransaction()
  async settleSucceededTransaction(params: {
    transactionId: string;
    chargeId: string | undefined;
    paymentMethodType: string | undefined;
    cardBrand: string | undefined;
    cardLast4: string | undefined;
    receiptUrl: string | undefined;
    stripePaymentIntentId: string | undefined;
    paymentAmount: number;
    userId: string;
    eventDescription: string;
    endTrial?: boolean;
  }): Promise<{ settled: boolean; bonusAmount: number; toppedUpWallet?: ToppedUpWallet }> {
    const transaction = await this.stripeTransactionRepository.findOneByAndLock({ id: params.transactionId });

    if (!transaction) {
      this.loggerService.warn({
        event: "TRANSACTION_NOT_FOUND_FOR_UPDATE",
        transactionId: params.transactionId,
        description: params.eventDescription
      });
      return { settled: false, bonusAmount: 0 };
    }

    if (SETTLED_TRANSACTION_STATUSES.has(transaction.status)) {
      this.loggerService.info({
        event: "PAYMENT_ALREADY_PROCESSED",
        transactionId: params.transactionId,
        status: transaction.status,
        description: params.eventDescription
      });
      return { settled: false, bonusAmount: 0 };
    }

    const bonusAmount = await this.firstPurchaseBonusService.getEligibleBonusAmount(transaction, params.paymentAmount);

    await this.stripeTransactionRepository.updateById(params.transactionId, {
      status: "succeeded",
      stripeChargeId: params.chargeId,
      paymentMethodType: params.paymentMethodType,
      cardBrand: params.cardBrand,
      cardLast4: params.cardLast4,
      receiptUrl: params.receiptUrl,
      stripePaymentIntentId: params.stripePaymentIntentId,
      ...(bonusAmount > 0 ? { bonusAmount } : {})
    });

    // Single combined top-up: two calls would double chain fees and race on retrieveDeploymentLimit.
    const toppedUpWallet = await this.refillService.topUpWallet(params.paymentAmount + bonusAmount, params.userId, {
      endTrial: params.endTrial,
      payment: {
        currency: transaction.currency,
        cardBrand: params.cardBrand,
        paymentMethodType: params.paymentMethodType,
        transactionId: transaction.id,
        source: transaction.type,
        ...(bonusAmount > 0 ? { bonusAmountCents: bonusAmount } : {})
      }
    });

    if (bonusAmount > 0) {
      this.firstPurchaseBonusService.trackBonusGranted(params.userId, params.paymentAmount, bonusAmount);
      this.loggerService.info({
        event: "FIRST_PURCHASE_BONUS_GRANTED",
        transactionId: params.transactionId,
        userId: params.userId,
        paidAmountCents: params.paymentAmount,
        bonusAmountCents: bonusAmount
      });
    }

    return { settled: true, bonusAmount, toppedUpWallet };
  }

  async settlePaymentIntent(event: Stripe.PaymentIntentSucceededEvent): Promise<SettlementOutcome> {
    const paymentIntent = event.data.object;
    const customerId = paymentIntent.customer as string;

    if (paymentIntent.metadata.type === "payment_method_validation") {
      this.loggerService.info({
        event: "SKIP_PAYMENT_METHOD_VALIDATION_PROCESSING",
        paymentIntentId: paymentIntent.id
      });
      return {};
    }

    const transaction = paymentIntent.metadata.internal_transaction_id
      ? await this.stripeTransactionRepository.findById(paymentIntent.metadata.internal_transaction_id)
      : await this.stripeTransactionRepository.findByPaymentIntentId(paymentIntent.id);

    assert(transaction, 500, "Failed to find existing transaction for payment intent", {
      paymentIntentId: paymentIntent.id,
      stripeTransactionId: paymentIntent.metadata.internal_transaction_id
    });

    const chargeId = paymentIntent.latest_charge
      ? typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge.id
      : undefined;

    return this.#settleFromWebhook({
      customerId,
      transaction,
      chargeId,
      paymentMethodType: paymentIntent.payment_method_types?.[0],
      paymentAmount: paymentIntent.amount_received ?? paymentIntent.amount,
      stripePaymentIntentId: paymentIntent.id,
      eventDescription: `payment_intent ${paymentIntent.id}`,
      isAutoRecharge: paymentIntent.metadata[AUTO_RECHARGE_METADATA_KEY] === "true"
    });
  }

  async settleInvoice(event: Stripe.InvoicePaidEvent | Stripe.InvoicePaymentSucceededEvent): Promise<SettlementOutcome> {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;

    const transaction = await this.stripeTransactionRepository.findByInvoiceId(invoice.id);
    if (!transaction) {
      // Double-credit guard: ordinary charged invoices have no pre-created row (only the coupon-claim
      // and admin manual-credit paths pre-create one), so they no-op here.
      this.loggerService.info({
        event: "INVOICE_NO_MATCHING_TRANSACTION",
        invoiceId: invoice.id
      });
      return {};
    }

    const payment = invoice.payments?.data[0]?.payment;
    const chargeId = payment?.charge ? (typeof payment.charge === "string" ? payment.charge : payment.charge.id) : undefined;
    const stripePaymentIntentId = payment?.payment_intent
      ? typeof payment.payment_intent === "string"
        ? payment.payment_intent
        : payment.payment_intent.id
      : undefined;
    // A granted manual credit must not graduate a trial user; every other invoice (coupon claims,
    // card purchases) leaves endTrial undefined so RefillService's default ends the trial.
    const endTrial = TRIAL_PRESERVING_TRANSACTION_TYPES.has(transaction.type) ? false : undefined;

    return this.#settleFromWebhook({
      customerId,
      transaction,
      chargeId,
      paymentMethodType: undefined,
      paymentAmount: transaction.amount,
      stripePaymentIntentId,
      eventDescription: `invoice ${invoice.id}`,
      endTrial,
      isAutoRecharge: false
    });
  }

  /**
   * Credits the wallet for a settled Stripe charge: resolves the owning user, enriches the row with the
   * charge's card details, and records the succeeded transaction. Once that transaction has committed it
   * publishes the draining-deployment funding command, then returns the events the caller should publish
   * (first-purchase bonus, automatic recharge success). Everything runs post-commit so a rolled-back credit
   * can neither fund deployments nor send an email. The auto-recharge event is returned only when this
   * delivery actually credited the wallet, so retries and replays never notify twice.
   */
  async #settleFromWebhook(params: {
    customerId: string | null;
    transaction: StripeTransactionOutput;
    chargeId: string | undefined;
    paymentMethodType: string | undefined;
    paymentAmount: number;
    stripePaymentIntentId: string | undefined;
    eventDescription: string;
    endTrial?: boolean;
    isAutoRecharge: boolean;
  }): Promise<SettlementOutcome> {
    if (!params.customerId) {
      this.loggerService.error({
        event: "PAYMENT_MISSING_CUSTOMER_ID",
        description: params.eventDescription
      });
      return {};
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: params.customerId });
    if (!user) {
      this.loggerService.error({
        event: "USER_NOT_FOUND",
        customerId: params.customerId,
        description: params.eventDescription
      });
      return {};
    }

    let cardBrand: string | undefined;
    let cardLast4: string | undefined;
    let receiptUrl: string | undefined;

    if (params.chargeId) {
      try {
        const charge = await this.stripe.charges.retrieve(params.chargeId);
        cardBrand = charge.payment_method_details?.card?.brand ?? undefined;
        cardLast4 = charge.payment_method_details?.card?.last4 ?? undefined;
        receiptUrl = charge.receipt_url ?? undefined;
      } catch (error) {
        this.loggerService.warn({
          event: "CHARGE_DETAILS_FETCH_FAILED",
          chargeId: params.chargeId,
          error
        });
      }
    }

    const { settled, bonusAmount, toppedUpWallet } = await this.settleSucceededTransaction({
      transactionId: params.transaction.id,
      chargeId: params.chargeId,
      paymentMethodType: params.paymentMethodType,
      cardBrand,
      cardLast4,
      receiptUrl,
      stripePaymentIntentId: params.stripePaymentIntentId,
      paymentAmount: params.paymentAmount,
      userId: user.id,
      eventDescription: params.eventDescription,
      endTrial: params.endTrial
    });

    if (toppedUpWallet) {
      await this.domainEventsService.publish(new FundDrainingDeploymentsCommand(toppedUpWallet), {
        singletonKey: `${FundDrainingDeploymentsCommand.name}.${toppedUpWallet.walletId}`
      });
    }

    return {
      bonusGrant: bonusAmount > 0 ? { userId: user.id, bonusAmountCents: bonusAmount, paidAmountCents: params.paymentAmount } : undefined,
      autoRecharge: settled && params.isAutoRecharge ? { userId: user.id, transactionId: params.transaction.id, amountCents: params.paymentAmount } : undefined
    };
  }

  @WithTransaction()
  async failPaymentIntent(event: Stripe.PaymentIntentPaymentFailedEvent): Promise<void> {
    const paymentIntent = event.data.object;
    const errorMessage = paymentIntent.last_payment_error?.message ?? "Payment failed";

    await this.stripeTransactionRepository.updateByPaymentIntentId(paymentIntent.id, {
      status: "failed",
      errorMessage
    });

    this.loggerService.warn({
      event: "PAYMENT_INTENT_FAILED",
      paymentIntentId: paymentIntent.id,
      errorMessage
    });
  }

  @WithTransaction()
  async cancelPaymentIntent(event: Stripe.PaymentIntentCanceledEvent): Promise<void> {
    const paymentIntent = event.data.object;

    await this.stripeTransactionRepository.updateByPaymentIntentId(paymentIntent.id, {
      status: "canceled"
    });

    this.loggerService.info({
      event: "PAYMENT_INTENT_CANCELED",
      paymentIntentId: paymentIntent.id
    });
  }

  async refundCharge(event: Stripe.ChargeRefundedEvent): Promise<void> {
    const charge = event.data.object;
    const customerId = charge.customer as string;

    if (!customerId) {
      this.loggerService.error({ event: "CHARGE_REFUNDED_MISSING_CUSTOMER_ID", chargeId: charge.id });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.loggerService.error({ event: "CHARGE_REFUNDED_USER_NOT_FOUND", customerId, chargeId: charge.id });
      return;
    }

    await this.applyRefund({
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
      fullyRefunded: charge.refunded,
      userId: user.id
    });
  }

  @WithTransaction()
  async applyRefund(params: { chargeId: string; amountRefunded: number; fullyRefunded: boolean; userId: string }): Promise<void> {
    // Locked read: concurrent charge.refunded deliveries serialize here, so the loser
    // re-reads the committed amountRefunded/status and bails on the idempotency check
    // instead of double-debiting the wallet.
    const transaction = await this.stripeTransactionRepository.findOneByAndLock({ stripeChargeId: params.chargeId });

    if (!transaction) {
      this.loggerService.warn({ event: "CHARGE_REFUNDED_NO_TRANSACTION", chargeId: params.chargeId });
      return;
    }

    // Idempotency check: if we've already processed up to this refund amount, skip
    if (transaction.amountRefunded >= params.amountRefunded) {
      this.loggerService.info({
        event: "CHARGE_REFUND_ALREADY_PROCESSED",
        chargeId: params.chargeId,
        transactionId: transaction.id,
        storedAmountRefunded: transaction.amountRefunded,
        incomingAmountRefunded: params.amountRefunded
      });
      return;
    }

    // Calculate delta based on what we've already processed, not previous_attributes
    // This handles both retries and partial refunds correctly
    const refundedAmount = params.amountRefunded - transaction.amountRefunded;
    if (refundedAmount <= 0) {
      this.loggerService.warn({ event: "CHARGE_REFUNDED_NO_DELTA", chargeId: params.chargeId, totalRefunded: params.amountRefunded });
      return;
    }

    // Only reduce wallet balance if the transaction was successful (user actually received credits)
    if (transaction.status !== "succeeded" && transaction.status !== "refunded") {
      this.loggerService.info({
        event: "CHARGE_REFUNDED_SKIPPED",
        chargeId: params.chargeId,
        transactionId: transaction.id,
        transactionStatus: transaction.status,
        reason: "Transaction was not in succeeded state, user never received credits"
      });
      return;
    }

    const isFullyRefunded = params.fullyRefunded;

    // Claw back the first-purchase bonus only on the first transition to fully-refunded
    // (pre-update status check); partial refunds never touch the bonus. bonusAmount stays
    // on the row as the audit record of the grant.
    const bonusClawback = isFullyRefunded && transaction.status !== "refunded" && transaction.bonusAmount > 0 ? transaction.bonusAmount : 0;

    await this.stripeTransactionRepository.updateById(transaction.id, {
      amountRefunded: params.amountRefunded,
      ...(isFullyRefunded ? { status: "refunded" } : {})
    });

    await this.refillService.reduceWalletBalance(refundedAmount + bonusClawback, params.userId, {
      currency: transaction.currency,
      transactionId: transaction.id
    });

    if (bonusClawback > 0) {
      this.loggerService.info({
        event: "FIRST_PURCHASE_BONUS_CLAWED_BACK",
        chargeId: params.chargeId,
        userId: params.userId,
        transactionId: transaction.id,
        bonusAmountCents: bonusClawback
      });
    }

    this.loggerService.info({
      event: "CHARGE_REFUNDED",
      chargeId: params.chargeId,
      userId: params.userId,
      refundedAmount,
      totalRefunded: params.amountRefunded,
      previouslyRefunded: transaction.amountRefunded,
      isFullyRefunded,
      transactionId: transaction.id
    });
  }

  async recordCouponClaim(params: {
    userId: string;
    amount: number;
    currency: string;
    couponId: string;
    promotionCodeId?: string;
    invoiceId: string;
    description: string;
  }): Promise<StripeTransactionOutput> {
    return this.stripeTransactionRepository.create({
      userId: params.userId,
      type: "coupon_claim",
      status: "pending",
      amount: params.amount,
      currency: params.currency,
      stripeCouponId: params.couponId,
      stripePromotionCodeId: params.promotionCodeId,
      stripeInvoiceId: params.invoiceId,
      description: params.description
    });
  }
}
