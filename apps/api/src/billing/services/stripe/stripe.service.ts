import type { LoggerService } from "@akashnetwork/logging";
import type { AnyAbility } from "@casl/ability";
import { ConstantBackoff, handleWhenResult, retry, TaskCancelledError, timeout, TimeoutStrategy, wrap } from "cockatiel";
import crypto from "crypto";
import { stringify } from "csv-stringify";
import assert from "http-assert";
import createError from "http-errors";
import difference from "lodash/difference";
import keyBy from "lodash/keyBy";
import orderBy from "lodash/orderBy";
import { Readable } from "stream";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { PaymentIntentResult, PaymentMethodValidationResult, Transaction } from "@src/billing/http-schemas/stripe.schema";
import {
  PaymentMethodRepository,
  SETTLED_TRANSACTION_STATUSES,
  StripeTransactionInput,
  StripeTransactionOutput,
  StripeTransactionRepository
} from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { IDEMPOTENCY_KEY_MISMATCH_ERROR_MESSAGE, PAYMENT_IN_PROGRESS_ERROR_MESSAGE } from "@src/billing/services/stripe-error/stripe-error.service";
import { type CreateLogger, LOGGER_FACTORY, WithTransaction } from "@src/core";
import { TimerService } from "@src/core/services/timer/timer.service";
import type { TransactionCsvRow } from "@src/types/transactions";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import type { PayingUser } from "../paying-user/paying-user";

interface StripePrices {
  unitAmount: number;
  isCustom: boolean;
  currency: string;
}

/**
 * We only support USD for Stripe payments. Hardcoding the currency at the single
 * payment-intent chokepoint guarantees no caller can ever create a non-USD charge.
 */
const STRIPE_CURRENCY = "usd";

/**
 * Prefix of the idempotency keys the confirm-payment controller builds from client attempt keys.
 * The service uses it to tell strict top-up attempts (reject on amount change; the client rotates
 * its key whenever the amount changes) from wallet auto-reload keys (tolerate a recomputed amount
 * and charge the recorded one, since the reload job re-derives live amounts on every redelivery).
 */
export const TOP_UP_IDEMPOTENCY_KEY_PREFIX = "topup_";

export type PaymentMethod = Stripe.PaymentMethod & { validated: boolean; isDefault: boolean };

@singleton()
export class StripeService extends Stripe {
  readonly isProduction = this.billingConfig.get("STRIPE_SECRET_KEY").startsWith("sk_live");

  /**
   * Statuses that should be applied later via Stripe webhooks. Both map to transaction status
   * "succeeded", and writing that from the request path would make the webhook's
   * `status !== "succeeded"` guard skip crediting the wallet: the customer would be charged
   * without ever receiving credits.
   */
  readonly #DEFERRED_STATUSES = new Set<Stripe.PaymentIntent.Status>(["succeeded", "requires_capture"]);
  private readonly loggerService: LoggerService;

  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly timerService: TimerService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    const secretKey = billingConfig.get("STRIPE_SECRET_KEY");
    super(secretKey, {
      apiVersion: "2025-10-29.clover",
      httpClient: Stripe.createFetchHttpClient() // need to use fetch API, so we can intercept it in tests with nock
    });
    this.loggerService = createLogger({ context: StripeService.name });
  }

  async createSetupIntent(customerId: string, { isFreeTrial }: { isFreeTrial: boolean }) {
    return await this.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card", "link"],
      ...(isFreeTrial && { metadata: { is_free_trial: "true" } })
    });
  }

  async findPrices(): Promise<StripePrices[]> {
    const { data: prices } = await this.prices.list({ active: true, product: this.billingConfig.get("STRIPE_PRODUCT_ID") });
    const responsePrices = prices.map(price => ({
      unitAmount: price.custom_unit_amount || !price.unit_amount ? undefined : price.unit_amount / 100,
      isCustom: !!price.custom_unit_amount,
      currency: price.currency
    }));

    return orderBy(responsePrices, ["isCustom", "unitAmount"], ["asc", "asc"]) as StripePrices[];
  }

  async getPaymentMethods(userId: string, customerId: string, ability: AnyAbility): Promise<PaymentMethod[]> {
    const [remotes, locals] = await Promise.all([
      this.paymentMethods.list({ customer: customerId }),
      this.paymentMethodRepository.accessibleBy(ability, "read").findByUserId(userId)
    ]);

    const localById = keyBy(locals, "paymentMethodId");
    const remoteIds: string[] = [];

    const merged = remotes.data
      .map(remote => {
        remoteIds.push(remote.id);
        return {
          ...remote,
          validated: !!localById[remote.id]?.isValidated,
          isDefault: !!localById[remote.id]?.isDefault
        };
      })
      .sort((a, b) => b.created - a.created);

    const outOfSyncIds = difference(remoteIds, Object.keys(localById));

    if (outOfSyncIds.length) {
      this.loggerService.warn({
        event: "STRIPE_PAYMENT_METHOD_OUT_OF_SYNC",
        userId,
        outOfSyncIds
      });
    }

    return merged;
  }

  async getDefaultPaymentMethod(user: PayingUser, ability: AnyAbility): Promise<PaymentMethod | undefined> {
    const [customer, local] = await Promise.all([
      this.customers.retrieve(user.stripeCustomerId, {
        expand: ["invoice_settings.default_payment_method"]
      }),
      this.paymentMethodRepository.accessibleBy(ability, "read").findDefaultByUserId(user.id)
    ]);

    assert(!customer.deleted, 402, "Payment account has been deleted");

    const remote = customer.invoice_settings.default_payment_method;

    if (typeof remote === "object" && remote && local) {
      return { ...remote, validated: local.isValidated, isDefault: local.isDefault };
    } else {
      this.loggerService.warn({
        event: "STRIPE_PAYMENT_METHOD_OUT_OF_SYNC",
        userId: user.id,
        remoteId: typeof remote === "string" ? remote : remote?.id,
        localId: local?.paymentMethodId
      });
    }
  }

  async hasPaymentMethod(paymentMethodId: string, user: UserOutput): Promise<boolean> {
    try {
      const paymentMethod = await this.paymentMethods.retrieve(paymentMethodId);
      const customerId = typeof paymentMethod.customer === "string" ? paymentMethod.customer : paymentMethod.customer?.id;

      return customerId === user.stripeCustomerId;
    } catch (error: unknown) {
      if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
        return false;
      }

      throw error;
    }
  }

  @WithTransaction()
  async markPaymentMethodAsDefault(paymentMethodId: string, user: PayingUser, ability: AnyAbility): Promise<PaymentMethod> {
    const [local, remote] = await Promise.all([
      this.paymentMethodRepository.accessibleBy(ability, "update").markAsDefault(paymentMethodId),
      this.paymentMethods.retrieve(paymentMethodId, undefined, { timeout: 3_000 })
    ]);

    assert(remote, 404, "Payment method not found", { source: "stripe" });

    if (local) {
      await this.markRemotePaymentMethodAsDefault(paymentMethodId, user);
      return { ...remote, validated: local.isValidated, isDefault: local.isDefault };
    }

    const fingerprint = this.extractFingerprint(remote);

    assert(fingerprint, 403, "Payment method cannot be set as default. No identifiable fingerprint found.");

    const newLocal = await this.paymentMethodRepository.accessibleBy(ability, "create").createAsDefault({
      userId: user.id,
      fingerprint,
      paymentMethodId
    });

    await this.markRemotePaymentMethodAsDefault(paymentMethodId, user);

    return { ...remote, validated: newLocal.isValidated, isDefault: newLocal.isDefault };
  }

  async markRemotePaymentMethodAsDefault(paymentMethodId: string, user: PayingUser): Promise<void> {
    await this.customers.update(
      user.stripeCustomerId,
      {
        invoice_settings: { default_payment_method: paymentMethodId }
      },
      { timeout: 3_000 }
    );
  }

  async createPaymentIntent(params: {
    userId: string;
    customer: string;
    payment_method: string;
    amount: number;
    confirm: boolean;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
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

    this.#ensureReusedKeyAmountConsistency(transaction, params.idempotencyKey, amountInCents);

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
    const paymentIntent = await this.paymentIntents.retrieve(stripePaymentIntentId);

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
   * for a different amount than was charged. Top-up keys reject a changed amount as a definitive
   * mismatch (the client rotates its key whenever the amount changes, so this only means a stale or
   * misbehaving client). Wallet-reload keys tolerate it (the reload job recomputes a live amount on
   * every redelivery of the same job id) and the flow proceeds with the recorded amount.
   */
  #ensureReusedKeyAmountConsistency(transaction: StripeTransactionOutput, idempotencyKey: string, requestedAmountInCents: number): void {
    if (transaction.amount === requestedAmountInCents) {
      return;
    }

    const isTopUpKey = idempotencyKey.startsWith(TOP_UP_IDEMPOTENCY_KEY_PREFIX);

    this.loggerService.warn({
      event: "PAYMENT_INTENT_KEY_AMOUNT_MISMATCH",
      transactionId: transaction.id,
      recordedAmount: transaction.amount,
      requestedAmount: requestedAmountInCents,
      isTopUpKey
    });

    if (isTopUpKey) {
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
      const paymentIntent = await this.paymentIntents.create(...createOptions);
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
        throw new Error(PAYMENT_IN_PROGRESS_ERROR_MESSAGE);
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

  async listPromotionCodes() {
    const promotionCodes = await this.promotionCodes.list({
      expand: ["data.promotion.coupon"]
    });
    return { promotionCodes: promotionCodes.data };
  }

  async findPromotionCodeByCode(code: string): Promise<Stripe.PromotionCode | undefined> {
    const { data: promotionCodes } = await this.promotionCodes.list({
      code,
      expand: ["data.promotion.coupon"]
    });

    return promotionCodes[0];
  }

  async applyCoupon(
    currentUser: UserOutput,
    couponCode: string
  ): Promise<{
    coupon: Stripe.Coupon | Stripe.PromotionCode;
    amountAdded: number;
    transactionId: string;
    transactionStatus: StripeTransactionOutput["status"];
  }> {
    const promotionCode = await this.findPromotionCodeByCode(couponCode);

    if (promotionCode) {
      const coupon = promotionCode.promotion.coupon;

      if (typeof coupon === "string" || !coupon) {
        throw new Error("Promotion code coupon was not expanded");
      }

      return this.applyCouponOrPromotionCode({
        currentUser,
        couponOrPromotion: promotionCode,
        coupon,
        updateField: "promotion_code",
        updateId: promotionCode.id
      });
    }

    // If no promotion code found, try to find a matching coupon
    const { coupons } = await this.listCoupons();
    const matchingCoupon = coupons.find(coupon => coupon.id === couponCode);

    if (matchingCoupon) {
      return this.applyCouponOrPromotionCode({
        currentUser,
        couponOrPromotion: matchingCoupon,
        coupon: matchingCoupon,
        updateField: "coupon",
        updateId: matchingCoupon.id
      });
    }

    throw new Error("No valid promotion code or coupon found with the provided code");
  }

  private async applyCouponOrPromotionCode({
    currentUser,
    couponOrPromotion,
    coupon,
    updateField,
    updateId
  }: {
    currentUser: UserOutput;
    couponOrPromotion: Stripe.Coupon | Stripe.PromotionCode;
    coupon: Stripe.Coupon;
    updateField: "promotion_code" | "coupon";
    updateId: string;
  }): Promise<{
    coupon: Stripe.Coupon | Stripe.PromotionCode;
    amountAdded: number;
    transactionId: string;
    transactionStatus: StripeTransactionOutput["status"];
  }> {
    this.loggerService.info({
      event: "APPLYING_COUPON",
      couponId: coupon.id,
      valid: coupon.valid,
      redeem_by: coupon.redeem_by,
      max_redemptions: coupon.max_redemptions,
      times_redeemed: coupon.times_redeemed,
      updateField,
      updateId
    });

    if (!coupon.valid) {
      throw new Error(updateField === "promotion_code" ? "Promotion code is invalid or expired" : "Coupon is invalid or expired");
    }

    if (coupon.percent_off) {
      throw new Error("Percentage-based coupons are not supported. Only fixed amount coupons are allowed.");
    }

    if (!coupon.amount_off) {
      throw new Error("Invalid coupon type. Only fixed amount coupons are supported.");
    }

    const amountToAdd = coupon.amount_off; // amount_off is already in cents

    // Ensure the user has a Stripe customer only once the coupon is known to be redeemable. Brand-new
    // accounts may not have one yet since it is created lazily by the add-payment-method flow (see
    // getStripeCustomerId); provisioning it earlier would create customers for invalid/unsupported coupons.
    const stripeCustomerId = await this.getStripeCustomerId(currentUser);

    let invoice: Stripe.Invoice | undefined;

    try {
      invoice = await this.invoices.create({
        customer: stripeCustomerId,
        auto_advance: false,
        ...(updateField === "promotion_code" ? { discounts: [{ promotion_code: updateId }] } : { discounts: [{ coupon: updateId }] })
      });

      this.loggerService.info({
        event: "INVOICE_CREATED_WITH_DISCOUNT",
        userId: currentUser.id,
        invoiceId: invoice.id,
        discountType: updateField
      });

      await this.invoiceItems.create({
        amount: amountToAdd,
        customer: stripeCustomerId,
        invoice: invoice.id,
        currency: "usd",
        description: "Akash Network Console"
      });

      invoice = await this.invoices.finalizeInvoice(invoice.id);

      this.loggerService.info({
        event: "INVOICE_FINALIZED_AND_PAID",
        userId: currentUser.id,
        invoiceId: invoice.id,
        status: invoice.status,
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid
      });

      const transaction = await this.stripeTransactionRepository.create({
        userId: currentUser.id,
        type: "coupon_claim",
        status: "pending",
        amount: amountToAdd,
        currency: coupon.currency ?? "usd",
        stripeCouponId: coupon.id,
        stripePromotionCodeId: updateField === "promotion_code" ? updateId : undefined,
        stripeInvoiceId: invoice.id,
        description: `Coupon: ${coupon.name || coupon.id}`
      });

      return { coupon: couponOrPromotion, amountAdded: amountToAdd / 100, transactionId: transaction.id, transactionStatus: transaction.status };
    } catch (error) {
      let isInvoiceRolledBack: boolean | undefined;

      if (invoice?.id) {
        isInvoiceRolledBack = await this.invoices
          .voidInvoice(invoice.id)
          .then(() => true)
          .catch(() => false);
      }

      this.loggerService.error({
        event: "COUPON_APPLICATION_FAILED",
        userId: currentUser.id,
        couponId: updateId,
        error,
        isInvoiceRolledBack
      });

      throw error;
    }
  }

  private static readonly TERMINAL_TRANSACTION_STATUSES: Set<StripeTransactionOutput["status"]> = new Set(["succeeded", "failed", "refunded", "canceled"]);

  private readonly resolveTransactionExecutor = wrap(
    timeout(60_000, TimeoutStrategy.Aggressive),
    retry(
      handleWhenResult(result => !StripeService.TERMINAL_TRANSACTION_STATUSES.has((result as StripeTransactionOutput).status)),
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

  async listCoupons() {
    const coupons = await this.coupons.list({
      limit: 100
    });
    return { coupons: coupons.data };
  }

  async getCoupon(couponId: string) {
    return await this.coupons.retrieve(couponId);
  }

  async getCustomerTransactions(
    customerId: string,
    options?: { limit?: number; startingAfter?: string; endingBefore?: string; startDate?: string; endDate?: string }
  ): Promise<{
    transactions: Transaction[];
    hasMore: boolean;
    nextPage: string | null;
    prevPage: string | null;
  }> {
    const created =
      options?.startDate || options?.endDate
        ? {
            gte: options?.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : undefined,
            lte: options?.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : undefined
          }
        : undefined;

    const charges = await this.charges.list({
      created,
      customer: customerId,
      limit: options?.limit ?? 100,
      starting_after: options?.startingAfter,
      ending_before: options?.endingBefore,
      expand: ["data.payment_intent"]
    });

    const internalTransactions = await this.stripeTransactionRepository.findByChargeIds(charges.data.map(charge => charge.id));
    const internalByChargeId = keyBy(internalTransactions, "stripeChargeId");

    const transactions = charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      bonusAmount: internalByChargeId[charge.id]?.bonusAmount ?? 0,
      currency: charge.currency,
      status: charge.status,
      created: charge.created,
      paymentMethod: charge.payment_method_details
        ? {
            ...charge.payment_method_details,
            link: charge.payment_method_details.link ? { email: undefined } : undefined
          }
        : null,
      receiptUrl: charge.receipt_url,
      description: charge.description,
      metadata: charge.metadata
    }));

    return {
      transactions,
      hasMore: charges.has_more,
      nextPage: charges.data[charges.data.length - 1]?.id,
      prevPage: options?.startingAfter ? charges.data[0]?.id : null
    };
  }

  async *exportTransactionsCsvStream(customerId: string, options: { startDate: string; endDate: string; timezone: string }): AsyncIterable<string> {
    const normalizedTimezone = this.normalizeTimeZone(options.timezone);
    const transactionGenerator = this.createTransactionGenerator(customerId, {
      ...options,
      timezone: normalizedTimezone
    });

    const csvStringifier = stringify({
      header: true,
      bom: true,
      columns: [
        { key: "id", header: "Transaction ID" },
        { key: "date", header: `Date (${normalizedTimezone})` },
        { key: "amount", header: "Amount" },
        { key: "bonusAmount", header: "Bonus" },
        { key: "currency", header: "Currency" },
        { key: "status", header: "Status" },
        { key: "paymentMethodType", header: "Payment Method" },
        { key: "cardBrand", header: "Card Brand" },
        { key: "cardLast4", header: "Card Last 4" },
        { key: "description", header: "Description" },
        { key: "receiptUrl", header: "Receipt URL" }
      ]
    });

    const sourceStream = Readable.from(transactionGenerator);

    const csvStream = sourceStream.pipe(csvStringifier);

    try {
      for await (const chunk of csvStream) {
        yield typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8");
      }
    } catch (error) {
      this.loggerService.error({ event: "CSV_STREAM_ERROR", error });
      throw error;
    }
  }

  private async *createTransactionGenerator(
    customerId: string,
    options: { startDate: string; endDate: string; timezone: string }
  ): AsyncGenerator<TransactionCsvRow, void, unknown> {
    let hasMore = true;
    let startingAfter: string | undefined;
    const batchSize = 100;
    let hasYieldedAny = false;

    while (hasMore) {
      try {
        const batch = await this.getCustomerTransactions(customerId, {
          limit: batchSize,
          startingAfter,
          startDate: options.startDate,
          endDate: options.endDate
        });

        for (const transaction of batch.transactions) {
          hasYieldedAny = true;

          yield this.transformTransactionForCsv(transaction, options.timezone);
        }

        hasMore = batch.hasMore;
        startingAfter = batch.nextPage || undefined;
      } catch (error) {
        this.loggerService.error({ event: "TRANSACTION_FETCH_ERROR", error, customerId, startingAfter });
        yield {
          id: `Error: ${(error as Error).message}`,
          date: "",
          amount: "",
          bonusAmount: "",
          currency: "",
          status: "",
          paymentMethodType: "",
          cardBrand: "",
          cardLast4: "",
          description: "",
          receiptUrl: ""
        };
        hasMore = false;
      }
    }

    if (!hasYieldedAny) {
      yield {
        id: "No transactions found for the specified date range",
        date: "",
        amount: "",
        bonusAmount: "",
        currency: "",
        status: "",
        paymentMethodType: "",
        cardBrand: "",
        cardLast4: "",
        description: "",
        receiptUrl: ""
      };
    }
  }

  private sanitizeForCsv(value: string): string {
    if (!value) return "";

    if (/^[=+\-@]/.test(value)) {
      return "'" + value;
    }

    return value;
  }

  private transformTransactionForCsv(transaction: Transaction, timeZone: string) {
    const amount = (transaction.amount / 100).toFixed(2);
    const date = new Date(transaction.created * 1000).toLocaleString("en-CA", {
      timeZone
    });

    return {
      id: transaction.id,
      date,
      amount,
      bonusAmount: ((transaction.bonusAmount ?? 0) / 100).toFixed(2),
      currency: transaction.currency.toUpperCase(),
      status: transaction.status,
      paymentMethodType: transaction.paymentMethod?.type || "",
      cardBrand: transaction.paymentMethod?.card?.brand || "",
      cardLast4: transaction.paymentMethod?.card?.last4 || "",
      description: this.sanitizeForCsv(transaction.description || ""),
      receiptUrl: transaction.receiptUrl || ""
    };
  }

  private normalizeTimeZone(tz: string): string {
    if (Intl.supportedValuesOf("timeZone").includes(tz)) {
      return tz;
    }

    return "UTC";
  }

  async getStripeCustomerId(user: UserOutput): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Stripe idempotency keyed on the user id so concurrent provisioning (eager registration +
    // lazy billing paths) can never create duplicate/orphaned customers before the DB update wins.
    const customer = await this.customers.create(
      {
        email: user.email ?? undefined,
        name: user.username ?? undefined,
        metadata: {
          userId: user.id
        }
      },
      { idempotencyKey: `create-customer:${user.id}` }
    );

    const updated = await this.userRepository.updateBy({ id: user.id, stripeCustomerId: null }, { stripeCustomerId: customer.id }, { returning: true });

    if (updated) {
      return updated.stripeCustomerId!;
    }

    // Concurrent creation detected: fetch and return the persisted customer ID
    const reloaded = await this.userRepository.findOneBy({ id: user.id });
    assert(reloaded?.stripeCustomerId, 500, "Failed to retrieve stripeCustomerId");
    return reloaded.stripeCustomerId;
  }

  async updateCustomerOrganization(customerId: string, organization: string): Promise<void> {
    const customer = await this.customers.retrieve(customerId);

    assert(!("deleted" in customer), 404, "Customer is deleted");

    await this.customers.update(customerId, {
      business_name: organization
    });
  }

  async hasDuplicateTrialAccount(paymentMethods: Stripe.PaymentMethod[], currentUserId: string): Promise<boolean> {
    this.loggerService.info({
      event: "VALIDATING_PAYMENT_METHODS_FOR_TRIAL",
      paymentMethodCount: paymentMethods.length,
      paymentMethodIds: paymentMethods.map(pm => pm.id),
      currentUserId
    });

    const fingerprints = paymentMethods.map(paymentMethod => this.extractFingerprint(paymentMethod)).filter(Boolean) as string[];

    if (!fingerprints.length) {
      return false;
    }

    const otherPaymentMethods = await this.paymentMethodRepository.findOthersTrialingByFingerprint(fingerprints, currentUserId);

    return !!otherPaymentMethods;
  }

  async createTestCharge(params: {
    customer: string;
    payment_method: string;
  }): Promise<{ success: boolean; paymentIntentId?: string; requiresAction?: boolean; clientSecret?: string }> {
    const user = await this.userRepository.findOneBy({ stripeCustomerId: params.customer });

    if (user) {
      const validatedPaymentMethods = await this.paymentMethodRepository.findValidatedByUserId(user.id);
      if (validatedPaymentMethods.some(pm => pm.paymentMethodId === params.payment_method)) {
        this.loggerService.info({
          event: "PAYMENT_METHOD_ALREADY_VALIDATED",
          customerId: params.customer,
          userId: user.id,
          paymentMethodId: params.payment_method
        });
        return { success: true, paymentIntentId: "already_validated" };
      }
    }

    // Generate idempotency key to prevent duplicate charges
    const idempotencyKey = `card_validation_${params.customer}_${params.payment_method}`;

    let paymentIntent: Stripe.PaymentIntent;

    try {
      paymentIntent = await this.paymentIntents.create(
        {
          amount: 100, // $1.00 USD in cents
          currency: STRIPE_CURRENCY,
          payment_method_types: ["card", "link"],
          capture_method: "manual", // Don't capture the charge, they expire after 7 days
          customer: params.customer,
          payment_method: params.payment_method,
          confirm: true,
          metadata: {
            type: "payment_method_validation",
            description: "Payment method validation charge"
          }
        },
        {
          idempotencyKey
        }
      );
    } catch (error) {
      // If this is an idempotency error, try to retrieve the existing payment intent
      if (error instanceof Stripe.errors.StripeError && error.code === "idempotency_key_in_use") {
        // Wait a moment and try to retrieve the payment intent
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the user to find any existing validations
        const user = await this.userRepository.findOneBy({ stripeCustomerId: params.customer });
        if (user) {
          // Check if payment method is already validated
          const existingValidation = await this.paymentMethodRepository.findValidatedByUserId(user.id);
          if (existingValidation.some(pm => pm.paymentMethodId === params.payment_method)) {
            this.loggerService.info({
              event: "PAYMENT_METHOD_ALREADY_VALIDATED",
              customerId: params.customer,
              userId: user.id,
              paymentMethodId: params.payment_method
            });
            return { success: true, paymentIntentId: "already_validated" };
          }
        }

        throw new Error("Duplicate card validation request detected. Please wait before retrying.");
      }
      throw error;
    }

    // Handle different payment intent statuses
    switch (paymentIntent.status) {
      case "succeeded":
      case "requires_capture":
        // For manual capture, both succeeded and requires_capture mean the authorization was successful
        // We don't need to cancel it since it's not captured yet
        this.loggerService.info({
          event: "CARD_VALIDATION_AUTHORIZATION_SUCCESSFUL",
          customerId: params.customer,
          paymentMethodId: params.payment_method,
          paymentIntentId: paymentIntent.id
        });

        await this.markPaymentMethodAsValidated(params.customer, params.payment_method, paymentIntent.id);
        return { success: true, paymentIntentId: paymentIntent.id };

      case "requires_action":
        // Card requires 3D Secure authentication
        this.loggerService.info({
          event: "CARD_VALIDATION_REQUIRES_3DS",
          customerId: params.customer,
          paymentMethodId: params.payment_method,
          paymentIntentId: paymentIntent.id
        });
        return {
          success: false,
          paymentIntentId: paymentIntent.id,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret || undefined
        };

      case "requires_payment_method":
        // Card was declined
        this.loggerService.warn({
          event: "CARD_VALIDATION_DECLINED",
          customerId: params.customer,
          paymentMethodId: params.payment_method,
          paymentIntentId: paymentIntent.id,
          lastPaymentError: paymentIntent.last_payment_error
        });
        return { success: false, paymentIntentId: paymentIntent.id };

      default:
        // Other statuses (processing, canceled, etc.)
        this.loggerService.warn({
          event: "CARD_VALIDATION_UNEXPECTED_STATUS",
          customerId: params.customer,
          paymentMethodId: params.payment_method,
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status
        });
        return { success: false, paymentIntentId: paymentIntent.id };
    }
  }

  async validatePaymentMethodAfter3DS(customerId: string, paymentMethodId: string, paymentIntentId: string): Promise<{ success: boolean }> {
    try {
      const paymentIntent = await this.paymentIntents.retrieve(paymentIntentId);

      const paymentIntentCustomerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id;
      assert(paymentIntentCustomerId === customerId, 403, "Payment intent does not belong to the user");

      // Ensure the PaymentIntent references the same payment method being validated
      const paymentIntentPaymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : paymentIntent.payment_method?.id;
      assert(paymentIntentPaymentMethodId === paymentMethodId, 403, "Payment intent does not reference the provided payment method");

      if (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture") {
        // Payment intent was successfully authenticated, mark payment method as validated
        await this.markPaymentMethodAsValidated(customerId, paymentMethodId, paymentIntentId);

        this.loggerService.info({
          event: "PAYMENT_METHOD_VALIDATED_AFTER_3DS",
          customerId,
          paymentMethodId,
          paymentIntentId,
          status: paymentIntent.status
        });

        return { success: true };
      } else {
        this.loggerService.warn({
          event: "PAYMENT_INTENT_NOT_SUCCESSFUL_AFTER_3DS",
          customerId,
          paymentMethodId,
          paymentIntentId,
          status: paymentIntent.status
        });

        return { success: false };
      }
    } catch (error) {
      this.loggerService.error({
        event: "FAILED_TO_CHECK_PAYMENT_INTENT_AFTER_3DS",
        customerId,
        paymentMethodId,
        paymentIntentId,
        error
      });
      throw error;
    }
  }

  async validatePaymentMethodForTrial(params: { customer: string; payment_method: string; userId: string }): Promise<PaymentMethodValidationResult> {
    const validationResult = await this.createTestCharge({
      customer: params.customer,
      payment_method: params.payment_method
    });

    // If the card requires 3D Secure authentication, reuse the existing payment intent
    if (validationResult.requiresAction) {
      return {
        success: false,
        requires3DS: true,
        clientSecret: validationResult.clientSecret || "",
        paymentIntentId: validationResult.paymentIntentId || "",
        paymentMethodId: params.payment_method
      };
    }

    if (!validationResult.success) {
      throw new Error("Card validation failed. Please ensure your payment method is valid and try again.");
    }

    return {
      success: true
    };
  }

  private async markPaymentMethodAsValidated(customerId: string, paymentMethodId: string, paymentIntentId: string): Promise<void> {
    try {
      const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
      if (user) {
        await this.paymentMethodRepository.markAsValidated(paymentMethodId, user.id);
        this.loggerService.info({
          event: "PAYMENT_METHOD_VALIDATED",
          customerId,
          userId: user.id,
          paymentMethodId,
          paymentIntentId
        });
      } else {
        this.loggerService.error({
          event: "USER_NOT_FOUND_FOR_VALIDATION",
          customerId,
          paymentMethodId
        });
      }
    } catch (validationError) {
      this.loggerService.error({
        event: "PAYMENT_METHOD_VALIDATION_UPDATE_FAILED",
        customerId,
        paymentMethodId,
        error: validationError
      });
      // Don't fail the test charge if validation update fails - the card is still valid
    }
  }

  extractFingerprint(paymentMethod: Stripe.PaymentMethod): string | undefined {
    if (paymentMethod.card?.fingerprint) {
      return paymentMethod.card.fingerprint;
    }

    if (paymentMethod.type === "link" && paymentMethod.link?.email) {
      return `link_${crypto.createHash("sha256").update(paymentMethod.link.email.toLowerCase()).digest("hex")}`;
    }
  }
}
