import { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { CheckoutSessionRepository, PaymentMethodRepository, StripeCouponRepository, StripeTransactionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { WithTransaction } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { BillingConfigService } from "../billing-config/billing-config.service";

@singleton()
export class StripeWebhookService {
  private readonly logger = LoggerService.forContext(StripeWebhookService.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly refillService: RefillService,
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly stripeCouponRepository: StripeCouponRepository
  ) {}

  async routeStripeEvent(signature: string, rawEvent: string) {
    const event = this.stripe.webhooks.constructEvent(rawEvent, signature, this.billingConfig.get("STRIPE_WEBHOOK_SECRET"));
    this.logger.info({
      event: "STRIPE_EVENT_RECEIVED",
      type: event.type,
      id: event.id,
      objectId: event.data.object.object
    });

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await this.tryToTopUpWalletForCheckout(event);
          break;
        case "payment_intent.succeeded":
          await this.tryToTopUpWalletFromPaymentIntent(event);
          break;
        case "payment_method.attached":
          await this.handlePaymentMethodAttached(event);
          break;
        case "payment_method.detached":
          await this.handlePaymentMethodDetached(event);
          break;

        case "customer.discount.created":
          await this.handleCustomerDiscountCreated(event);
          break;
      }
    } catch (error) {
      this.logger.error({
        event: "STRIPE_EVENT_PROCESSING_ERROR",
        type: event.type,
        id: event.id,
        error
      });
      throw error;
    }
  }

  @WithTransaction()
  async tryToTopUpWalletForCheckout(event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent) {
    const sessionId = event.data.object.id;
    const checkoutSessionCache = await this.checkoutSessionRepository.findOneByAndLock({ sessionId });

    if (!checkoutSessionCache) {
      this.logger.info({ event: "SESSION_NOT_FOUND", sessionId });
      return;
    }

    const checkoutSession = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"]
    });

    if (checkoutSession.payment_status !== "unpaid") {
      await this.refillService.topUpWallet(checkoutSession.amount_subtotal!, checkoutSessionCache.userId);
      await this.checkoutSessionRepository.deleteBy({ sessionId });
    } else {
      this.logger.error({ event: "PAYMENT_NOT_COMPLETED", sessionId });
    }
  }

  @WithTransaction()
  async tryToTopUpWalletFromPaymentIntent(event: Stripe.PaymentIntentSucceededEvent) {
    const paymentIntent = event.data.object;
    const customerId = paymentIntent.customer as string;

    if (!customerId) {
      this.logger.error({
        event: "PAYMENT_INTENT_MISSING_CUSTOMER_ID",
        paymentIntentId: paymentIntent.id
      });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.logger.error({
        event: "USER_NOT_FOUND",
        customerId,
        paymentIntentId: paymentIntent.id
      });
      return;
    }

    // Get discount information from metadata
    const metadata = paymentIntent.metadata;
    const originalAmount =
      metadata?.original_amount && !Number.isNaN(parseFloat(metadata.original_amount)) ? parseFloat(metadata.original_amount) : paymentIntent.amount;
    const discountApplied = metadata?.discount_applied === "true";

    // If a discount was applied, consume the promotion code
    if (discountApplied) {
      try {
        const consumed = await this.stripe.consumeActiveDiscount(customerId);
        if (consumed) {
          this.logger.info({
            event: "DISCOUNT_CONSUMED",
            customerId,
            originalAmount,
            finalAmount: paymentIntent.amount
          });
        } else {
          this.logger.error({
            event: "FAILED_TO_CONSUME_DISCOUNT",
            customerId,
            originalAmount,
            finalAmount: paymentIntent.amount
          });
        }
      } catch (error) {
        this.logger.error({
          event: "FAILED_TO_CONSUME_DISCOUNT",
          customerId,
          error
        });
      }
    }

    // Record the transaction in our database
    await this.recordPaymentIntentTransaction(paymentIntent, user.id, customerId, originalAmount);

    // Use the original amount for the wallet top-up
    await this.refillService.topUpWallet(originalAmount, user.id);
  }

  @WithTransaction()
  async handlePaymentMethodAttached(event: Stripe.PaymentMethodAttachedEvent) {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer as string;

    if (!customerId) {
      this.logger.error({
        event: "PAYMENT_METHOD_MISSING_CUSTOMER_ID",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.logger.error({
        event: "USER_NOT_FOUND_FOR_PAYMENT_METHOD",
        customerId,
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const fingerprint = paymentMethod.card?.fingerprint;
    if (!fingerprint) {
      this.logger.error({
        event: "PAYMENT_METHOD_MISSING_FINGERPRINT",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    await this.paymentMethodRepository.create({
      userId: user.id,
      fingerprint,
      paymentMethodId: paymentMethod.id
    });

    this.logger.info({
      event: "PAYMENT_METHOD_ATTACHED",
      paymentMethodId: paymentMethod.id,
      userId: user.id,
      fingerprint
    });
  }

  @WithTransaction()
  async handlePaymentMethodDetached(event: Stripe.PaymentMethodDetachedEvent) {
    const paymentMethod = event.data.object;
    const customerId = paymentMethod.customer || event.data.previous_attributes?.customer;
    const fingerprint = paymentMethod.card?.fingerprint;

    this.logger.info({
      event: "PAYMENT_METHOD_DETACHED",
      paymentMethodId: paymentMethod.id,
      customerId,
      fingerprint
    });

    if (!fingerprint) {
      this.logger.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_FINGERPRINT",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    if (!customerId) {
      this.logger.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_CUSTOMER_ID",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const currentUser = await this.userRepository.findOneBy({ stripeCustomerId: customerId as string });
    if (!currentUser) {
      this.logger.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_USER",
        paymentMethodId: paymentMethod.id
      });
      return;
    }

    const deletedPaymentMethod = await this.paymentMethodRepository.deleteByFingerprint(fingerprint, paymentMethod.id, currentUser.id);

    this.logger.info({
      event: "PAYMENT_METHOD_DETACHED",
      paymentMethodId: paymentMethod.id,
      fingerprint,
      deleted: !!deletedPaymentMethod
    });
  }

  private async recordPaymentIntentTransaction(paymentIntent: Stripe.PaymentIntent, userId: string, customerId: string, amount: number) {
    // Check if transaction already exists
    const existingTransaction = await this.stripeTransactionRepository.findByStripeTransactionId(paymentIntent.id);
    if (existingTransaction) {
      this.logger.info({
        event: "PAYMENT_INTENT_TRANSACTION_ALREADY_EXISTS",
        paymentIntentId: paymentIntent.id,
        userId
      });
      return;
    }

    // Create transaction record
    await this.stripeTransactionRepository.create({
      stripeTransactionId: paymentIntent.id,
      userId,
      stripeCustomerId: customerId,
      amount: amount.toString(),
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      description: paymentIntent.description,
      receiptUrl: null, // Payment intents don't have receipt URLs
      metadata: paymentIntent.metadata,
      stripeCreatedAt: new Date(paymentIntent.created * 1000)
    });

    this.logger.info({
      event: "PAYMENT_INTENT_TRANSACTION_RECORDED",
      paymentIntentId: paymentIntent.id,
      userId,
      amount,
      currency: paymentIntent.currency
    });
  }

  @WithTransaction()
  async handleCustomerDiscountCreated(event: Stripe.CustomerDiscountCreatedEvent) {
    const discount = event.data.object;
    const customerId = discount.customer as string;

    if (!customerId) {
      this.logger.error({
        event: "DISCOUNT_MISSING_CUSTOMER_ID",
        discountId: discount.id
      });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.logger.error({
        event: "USER_NOT_FOUND_FOR_DISCOUNT",
        customerId,
        discountId: discount.id
      });
      return;
    }

    // Check if coupon already exists
    const existingCoupon = await this.stripeCouponRepository.findByStripeCouponId(discount.id);
    if (existingCoupon) {
      this.logger.info({
        event: "DISCOUNT_ALREADY_EXISTS",
        discountId: discount.id,
        userId: user.id
      });
      return;
    }

    // Create coupon record for claimed discount
    await this.stripeCouponRepository.create({
      stripeCouponId: discount.id,
      userId: user.id,
      stripeCustomerId: customerId,
      stripeTransactionId: `discount_${discount.id}`, // No transaction yet, will be updated when used
      couponCode: discount.coupon?.id,
      discountAmount: null, // Will be populated when used
      discountType: "fixed_amount", // Default type
      currency: "usd", // Default currency
      metadata: {},
      stripeCreatedAt: new Date()
    });

    this.logger.info({
      event: "DISCOUNT_CLAIMED_RECORDED",
      discountId: discount.id,
      userId: user.id,
      customerId,
      couponCode: discount.coupon?.id
    });
  }
}
