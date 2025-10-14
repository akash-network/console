import { stringify } from "csv-stringify";
import assert from "http-assert";
import orderBy from "lodash/orderBy";
import { Readable } from "stream";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { PaymentIntentResult, PaymentMethodValidationResult, Transaction } from "@src/billing/http-schemas/stripe.schema";
import { PaymentMethodRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { LoggerService } from "@src/core/providers/logging.provider";
import { TransactionCsvRow } from "@src/types/transactions";
import { UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

const logger = LoggerService.forContext("StripeService");

interface CheckoutOptions {
  customerId: string;
  redirectUrl: string;
  amount?: string;
}

interface StripePrices {
  unitAmount: number;
  isCustom: boolean;
  currency: string;
}
@singleton()
export class StripeService extends Stripe {
  readonly isProduction = this.billingConfig.get("STRIPE_SECRET_KEY").startsWith("sk_live");

  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    private readonly refillService: RefillService,
    private readonly paymentMethodRepository: PaymentMethodRepository
  ) {
    const secretKey = billingConfig.get("STRIPE_SECRET_KEY");
    super(secretKey, {
      apiVersion: "2024-06-20"
    });
  }

  async createSetupIntent(customerId: string) {
    return await this.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card", "link"]
    });
  }

  async startCheckoutSession(options: CheckoutOptions) {
    const price = await this.getPrice(options.amount);

    return await this.checkout.sessions.create({
      line_items: [
        {
          price: price.id,
          quantity: 1
        }
      ],
      mode: "payment",
      allow_promotion_codes: !!options.amount,
      customer: options.customerId,
      success_url: `${options.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&payment-success=true`,
      cancel_url: `${options.redirectUrl}?session_id={CHECKOUT_SESSION_ID}&payment-canceled=true`
    });
  }

  private async getPrice(amount?: string) {
    const { data: prices } = await this.prices.list({ active: true, product: this.billingConfig.get("STRIPE_PRODUCT_ID") });

    const price = prices.find(price => {
      const isCustom = !amount && !!price.custom_unit_amount;

      if (isCustom) {
        return true;
      }

      return price.unit_amount === Number(amount) * 100;
    });

    assert(price, 400, "Price invalid");

    return price;
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

  async getPaymentMethods(userId: string, customerId: string): Promise<(Stripe.PaymentMethod & { validated: boolean })[]> {
    const [paymentMethods, dbPaymentMethods] = await Promise.all([
      this.paymentMethods.list({
        customer: customerId
      }),
      this.paymentMethodRepository.findByUserId(userId)
    ]);

    return paymentMethods.data
      .map(paymentMethod => ({
        ...paymentMethod,
        validated: dbPaymentMethods?.some(pm => pm.paymentMethodId === paymentMethod.id && pm.isValidated)
      }))
      .sort((a, b) => b.created - a.created);
  }

  async createPaymentIntent(params: {
    customer: string;
    payment_method: string;
    amount: number;
    currency: string;
    confirm: boolean;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntentResult> {
    // Convert amount to cents for stripe
    const amountCents = Math.round(params.amount * 100);

    const paymentIntent = await this.paymentIntents.create({
      customer: params.customer,
      payment_method: params.payment_method,
      amount: amountCents,
      currency: params.currency,
      confirm: params.confirm,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never"
      }
    });

    switch (paymentIntent.status) {
      case "succeeded":
      case "requires_capture":
        return { success: true, paymentIntentId: paymentIntent.id };

      case "requires_action":
        // Card requires 3D Secure authentication
        return {
          success: false,
          paymentIntentId: paymentIntent.id,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret || undefined
        };

      case "requires_payment_method":
        // Card was declined
        throw new Error("Payment method was declined. Please try a different card.");

      default:
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }
  }

  async listPromotionCodes() {
    const promotionCodes = await this.promotionCodes.list({
      expand: ["data.coupon"]
    });
    return { promotionCodes: promotionCodes.data };
  }

  async findPromotionCodeByCode(code: string) {
    const { data: promotionCodes } = await this.promotionCodes.list({
      code,
      expand: ["data.coupon"]
    });
    return promotionCodes[0];
  }

  async applyCoupon(currentUser: UserOutput, couponCode: string): Promise<{ coupon: Stripe.Coupon | Stripe.PromotionCode; amountAdded: number }> {
    const promotionCode = await this.findPromotionCodeByCode(couponCode);

    if (promotionCode) {
      return this.applyCouponOrPromotionCode({
        currentUser,
        couponOrPromotion: promotionCode,
        coupon: promotionCode.coupon,
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
  }): Promise<{ coupon: Stripe.Coupon | Stripe.PromotionCode; amountAdded: number }> {
    if (!coupon.valid) {
      throw new Error(updateField === "promotion_code" ? "Promotion code is invalid or expired" : "Coupon is invalid or expired");
    }

    if (coupon.percent_off) {
      throw new Error("Percentage-based coupons are not supported. Only fixed amount coupons are allowed.");
    }

    if (!coupon.amount_off) {
      throw new Error("Invalid coupon type. Only fixed amount coupons are supported.");
    }

    assert(currentUser.stripeCustomerId, 500, "Payment account not properly configured. Please contact support.");

    const amountToAdd = coupon.amount_off; // amount_off is already in cents
    let couponApplied = false;

    try {
      await this.customers.update(currentUser.stripeCustomerId, {
        [updateField]: updateId
      });
      couponApplied = true;

      if (amountToAdd > 0) {
        await this.refillService.topUpWallet(amountToAdd, currentUser.id);
      }

      await this.customers.update(currentUser.stripeCustomerId, {
        [updateField]: null
      });

      return { coupon: couponOrPromotion, amountAdded: amountToAdd / 100 };
    } catch (error) {
      if (couponApplied) {
        try {
          await this.customers.update(currentUser.stripeCustomerId, {
            [updateField]: null
          });
          logger.info({
            event: "COUPON_APPLICATION_ROLLBACK_SUCCESS",
            userId: currentUser.id,
            couponId: updateId,
            error: error instanceof Error ? error.message : String(error)
          });
        } catch (rollbackError) {
          logger.error({
            event: "COUPON_APPLICATION_ROLLBACK_FAILED",
            userId: currentUser.id,
            couponId: updateId,
            error: new AggregateError([error, rollbackError])
          });
        }
      }

      throw error;
    }
  }

  async listCoupons() {
    const coupons = await this.coupons.list({
      limit: 100
    });
    return { coupons: coupons.data };
  }

  async getCoupon(couponId: string) {
    const coupon = await this.coupons.retrieve(couponId);
    return coupon;
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

    const transactions = charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      created: charge.created,
      paymentMethod: charge.payment_method_details,
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
      logger.error({ event: "CSV_STREAM_ERROR", error });
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
        logger.error({ event: "TRANSACTION_FETCH_ERROR", error, customerId, startingAfter });
        yield {
          id: `Error: ${(error as Error).message}`,
          date: "",
          amount: "",
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

    const customer = await this.customers.create({
      email: user.email ?? undefined,
      name: user.username ?? undefined,
      metadata: {
        userId: user.id
      }
    });

    const updated = await this.userRepository.updateBy({ id: user.id, stripeCustomerId: null }, { stripeCustomerId: customer.id }, { returning: true });

    if (updated) {
      return updated.stripeCustomerId!;
    }

    // Concurrent creation detected: fetch and return the persisted customer ID
    const reloaded = await this.userRepository.findOneBy({ id: user.id });
    assert(reloaded?.stripeCustomerId, 500, "Failed to retrieve stripeCustomerId");
    return reloaded.stripeCustomerId;
  }

  async hasDuplicateTrialAccount(paymentMethods: Stripe.PaymentMethod[], currentUserId: string): Promise<boolean> {
    logger.info({
      event: "VALIDATING_PAYMENT_METHODS_FOR_TRIAL",
      paymentMethodCount: paymentMethods.length,
      paymentMethodIds: paymentMethods.map(pm => pm.id),
      currentUserId
    });

    const fingerprints = paymentMethods.map(paymentMethod => paymentMethod.card?.fingerprint).filter(Boolean) as string[];

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
        logger.info({
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
          currency: "usd",
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
            logger.info({
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
        logger.info({
          event: "CARD_VALIDATION_AUTHORIZATION_SUCCESSFUL",
          customerId: params.customer,
          paymentMethodId: params.payment_method,
          paymentIntentId: paymentIntent.id
        });

        await this.markPaymentMethodAsValidated(params.customer, params.payment_method, paymentIntent.id);
        return { success: true, paymentIntentId: paymentIntent.id };

      case "requires_action":
        // Card requires 3D Secure authentication
        logger.info({
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
        logger.warn({
          event: "CARD_VALIDATION_DECLINED",
          customerId: params.customer,
          paymentMethodId: params.payment_method,
          paymentIntentId: paymentIntent.id,
          lastPaymentError: paymentIntent.last_payment_error
        });
        return { success: false, paymentIntentId: paymentIntent.id };

      default:
        // Other statuses (processing, canceled, etc.)
        logger.warn({
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

        logger.info({
          event: "PAYMENT_METHOD_VALIDATED_AFTER_3DS",
          customerId,
          paymentMethodId,
          paymentIntentId,
          status: paymentIntent.status
        });

        return { success: true };
      } else {
        logger.warn({
          event: "PAYMENT_INTENT_NOT_SUCCESSFUL_AFTER_3DS",
          customerId,
          paymentMethodId,
          paymentIntentId,
          status: paymentIntent.status
        });

        return { success: false };
      }
    } catch (error) {
      logger.error({
        event: "FAILED_TO_CHECK_PAYMENT_INTENT_AFTER_3DS",
        customerId,
        paymentMethodId,
        paymentIntentId,
        error: error instanceof Error ? error.message : String(error)
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
        logger.info({
          event: "PAYMENT_METHOD_VALIDATED",
          customerId,
          userId: user.id,
          paymentMethodId,
          paymentIntentId
        });
      } else {
        logger.error({
          event: "USER_NOT_FOUND_FOR_VALIDATION",
          customerId,
          paymentMethodId
        });
      }
    } catch (validationError) {
      logger.error({
        event: "PAYMENT_METHOD_VALIDATION_UPDATE_FAILED",
        customerId,
        paymentMethodId,
        error: validationError instanceof Error ? validationError.message : String(validationError)
      });
      // Don't fail the test charge if validation update fails - the card is still valid
    }
  }
}
