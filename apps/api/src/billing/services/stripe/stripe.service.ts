import type { LoggerService } from "@akashnetwork/logging";
import assert from "http-assert";
import orderBy from "lodash/orderBy";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { extractFingerprint } from "@src/billing/lib/payment-method/extract-fingerprint";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { PaymentMethodRepository, StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";

interface StripePrices {
  unitAmount: number;
  isCustom: boolean;
  currency: string;
}

/**
 * We only support USD for Stripe payments. Hardcoding the currency at every charge-creation
 * chokepoint guarantees no caller can ever create a non-USD charge.
 */
export const STRIPE_CURRENCY = "usd";

/**
 * Namespace prefix the confirm-payment controller adds to client attempt keys so top-up
 * idempotency keys never collide with other flows'. Whether a reused key tolerates a changed
 * amount is an explicit policy the caller passes to StripeTransactionService, not something
 * inferred from this prefix.
 */
export const TOP_UP_IDEMPOTENCY_KEY_PREFIX = "topup_";

@singleton()
export class StripeService {
  readonly isProduction = this.billingConfig.get("STRIPE_SECRET_KEY").startsWith("sk_live");

  private readonly loggerService: LoggerService;

  constructor(
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: StripeService.name });
  }

  async createSetupIntent(customerId: string, { isFreeTrial }: { isFreeTrial: boolean }) {
    return await this.stripe.setupIntents.create({
      customer: customerId,
      usage: "off_session",
      payment_method_types: ["card", "link"],
      ...(isFreeTrial && { metadata: { is_free_trial: "true" } })
    });
  }

  retrievePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.detach(paymentMethodId);
  }

  retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    return this.stripe.charges.retrieve(chargeId);
  }

  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, this.billingConfig.get("STRIPE_WEBHOOK_SECRET"));
  }

  async findPrices(): Promise<StripePrices[]> {
    const { data: prices } = await this.stripe.prices.list({ active: true, product: this.billingConfig.get("STRIPE_PRODUCT_ID") });
    const responsePrices = prices.map(price => ({
      unitAmount: price.custom_unit_amount || !price.unit_amount ? undefined : price.unit_amount / 100,
      isCustom: !!price.custom_unit_amount,
      currency: price.currency
    }));

    return orderBy(responsePrices, ["isCustom", "unitAmount"], ["asc", "asc"]) as StripePrices[];
  }

  async listPromotionCodes() {
    const promotionCodes = await this.stripe.promotionCodes.list({
      expand: ["data.promotion.coupon"]
    });
    return { promotionCodes: promotionCodes.data };
  }

  async findPromotionCodeByCode(code: string): Promise<Stripe.PromotionCode | undefined> {
    const { data: promotionCodes } = await this.stripe.promotionCodes.list({
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
      invoice = await this.stripe.invoices.create({
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

      await this.stripe.invoiceItems.create({
        amount: amountToAdd,
        customer: stripeCustomerId,
        invoice: invoice.id,
        currency: "usd",
        description: "Akash Network Console"
      });

      invoice = await this.stripe.invoices.finalizeInvoice(invoice.id);

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
        isInvoiceRolledBack = await this.stripe.invoices
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

  async listCoupons() {
    const coupons = await this.stripe.coupons.list({
      limit: 100
    });
    return { coupons: coupons.data };
  }

  async getCoupon(couponId: string) {
    return await this.stripe.coupons.retrieve(couponId);
  }

  async getStripeCustomerId(user: UserOutput): Promise<string> {
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Stripe idempotency keyed on the user id so concurrent provisioning (eager registration +
    // lazy billing paths) can never create duplicate/orphaned customers before the DB update wins.
    const customer = await this.stripe.customers.create(
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
    const customer = await this.stripe.customers.retrieve(customerId);

    assert(!("deleted" in customer), 404, "Customer is deleted");

    await this.stripe.customers.update(customerId, {
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

    const fingerprints = paymentMethods.map(paymentMethod => extractFingerprint(paymentMethod)).filter(Boolean) as string[];

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
      paymentIntent = await this.stripe.paymentIntents.create(
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

        throw new Error("Duplicate card validation request detected. Please wait before retrying.", { cause: error });
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
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

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
}
