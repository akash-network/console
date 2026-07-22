import type { LoggerService } from "@akashnetwork/logging";
import { ConstantBackoff, handleWhenResult, retry, TaskCancelledError, timeout, TimeoutStrategy, wrap } from "cockatiel";
import assert from "http-assert";
import createError from "http-errors";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { PaymentIntentResult } from "@src/billing/http-schemas/stripe.schema";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { SETTLED_TRANSACTION_STATUSES, StripeTransactionInput, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { STRIPE_CURRENCY } from "@src/billing/services/stripe/stripe.service";
import { IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE, PAYMENT_IN_PROGRESS_ERROR_MESSAGE } from "@src/billing/services/stripe-error/stripe-error.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { TimerService } from "@src/core/services/timer/timer.service";

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
    private readonly timerService: TimerService,
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
        const message = paymentIntent.last_payment_error?.message ?? transaction.errorMessage ?? "Payment method was declined. Please try a different card.";

        const updated = await this.stripeTransactionRepository.updateByIdUnlessSettled(transaction.id, {
          status: this.mapPaymentIntentStatusToTransactionStatus(paymentIntent.status),
          errorMessage: message
        });

        if (!updated) {
          const settled = await this.#resultFromSettledWinner(transaction.id, paymentIntent.id);
          if (settled) return settled;
        }

        throw createError(402, message, { errorCode: "card_declined", errorType: "payment_error" });
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
    params: { customer: string; payment_method: string; confirm: boolean; metadata?: Record<string, string>; idempotencyKey?: string }
  ): Promise<PaymentIntentResult> {
    const createOptions: Parameters<Stripe["paymentIntents"]["create"]> = [
      {
        customer: params.customer,
        payment_method: params.payment_method,
        amount: transaction.amount,
        currency: STRIPE_CURRENCY,
        confirm: params.confirm,
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
          throw new Error("Payment method was declined. Please try a different card.");

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
}
