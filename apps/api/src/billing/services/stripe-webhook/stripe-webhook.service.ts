import { LoggerService } from "@akashnetwork/logging";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { PaymentMethodRepository, StripeTransactionRepository } from "@src/billing/repositories";
import { assertIsPayingUser } from "@src/billing/services/paying-user/paying-user";
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
    private readonly refillService: RefillService,
    private readonly billingConfig: BillingConfigService,
    private readonly userRepository: UserRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository
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
        case "payment_intent.succeeded":
          await this.tryToTopUpWalletFromPaymentIntent(event);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentIntentFailed(event);
          break;
        case "payment_intent.canceled":
          await this.handlePaymentIntentCanceled(event);
          break;
        case "charge.refunded":
          await this.handleChargeRefunded(event);
          break;
        case "payment_method.attached":
          await this.handlePaymentMethodAttached(event);
          break;
        case "payment_method.detached":
          await this.handlePaymentMethodDetached(event);
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

    // Update transaction status with charge details
    const chargeId = paymentIntent.latest_charge
      ? typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge.id
      : undefined;

    const paymentMethodDetails = paymentIntent.payment_method_types?.[0];

    // Fetch charge details to get card info and receipt URL
    let cardBrand: string | undefined;
    let cardLast4: string | undefined;
    let receiptUrl: string | undefined;

    if (chargeId) {
      try {
        const charge = await this.stripe.charges.retrieve(chargeId);
        cardBrand = charge.payment_method_details?.card?.brand ?? undefined;
        cardLast4 = charge.payment_method_details?.card?.last4 ?? undefined;
        receiptUrl = charge.receipt_url ?? undefined;
      } catch (error) {
        this.logger.warn({
          event: "CHARGE_DETAILS_FETCH_FAILED",
          chargeId,
          error
        });
      }
    }

    await this.stripeTransactionRepository.updateStatusByPaymentIntentId(paymentIntent.id, {
      status: "succeeded",
      stripeChargeId: chargeId,
      paymentMethodType: paymentMethodDetails,
      cardBrand,
      cardLast4,
      receiptUrl
    });

    // Use amount_received when available (for partial captures), otherwise use amount
    const paymentAmount = paymentIntent.amount_received ?? paymentIntent.amount;
    await this.refillService.topUpWallet(paymentAmount, user.id);
  }

  @WithTransaction()
  async handlePaymentIntentFailed(event: Stripe.PaymentIntentPaymentFailedEvent) {
    const paymentIntent = event.data.object;
    const errorMessage = paymentIntent.last_payment_error?.message ?? "Payment failed";

    await this.stripeTransactionRepository.updateStatusByPaymentIntentId(paymentIntent.id, {
      status: "failed",
      errorMessage
    });

    this.logger.warn({
      event: "PAYMENT_INTENT_FAILED",
      paymentIntentId: paymentIntent.id,
      errorMessage
    });
  }

  @WithTransaction()
  async handlePaymentIntentCanceled(event: Stripe.PaymentIntentCanceledEvent) {
    const paymentIntent = event.data.object;

    await this.stripeTransactionRepository.updateStatusByPaymentIntentId(paymentIntent.id, {
      status: "canceled"
    });

    this.logger.info({
      event: "PAYMENT_INTENT_CANCELED",
      paymentIntentId: paymentIntent.id
    });
  }

  @WithTransaction()
  async handleChargeRefunded(event: Stripe.ChargeRefundedEvent) {
    const charge = event.data.object;
    const customerId = charge.customer as string;

    if (!customerId) {
      this.logger.error({ event: "CHARGE_REFUNDED_MISSING_CUSTOMER_ID", chargeId: charge.id });
      return;
    }

    const refundedAmount = this.calculateRefundDelta(event);
    if (refundedAmount <= 0) {
      this.logger.warn({ event: "CHARGE_REFUNDED_NO_DELTA", chargeId: charge.id, totalRefunded: charge.amount_refunded });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: customerId });
    if (!user) {
      this.logger.error({ event: "CHARGE_REFUNDED_USER_NOT_FOUND", customerId, chargeId: charge.id });
      return;
    }

    const transaction = await this.stripeTransactionRepository.findByChargeId(charge.id);

    if (!transaction) {
      this.logger.warn({ event: "CHARGE_REFUNDED_NO_TRANSACTION", chargeId: charge.id });
      return;
    }

    // Only reduce wallet balance if the transaction was successful (user actually received credits)
    if (transaction.status !== "succeeded") {
      this.logger.info({
        event: "CHARGE_REFUNDED_SKIPPED",
        chargeId: charge.id,
        transactionId: transaction.id,
        transactionStatus: transaction.status,
        reason: "Transaction was not in succeeded state, user never received credits"
      });
      return;
    }

    const isFullyRefunded = charge.refunded;

    if (isFullyRefunded) {
      await this.stripeTransactionRepository.updateById(transaction.id, { status: "refunded" });
    }

    await this.refillService.reduceWalletBalance(refundedAmount, user.id);

    this.logger.info({
      event: "CHARGE_REFUNDED",
      chargeId: charge.id,
      userId: user.id,
      refundedAmount,
      totalRefunded: charge.amount_refunded,
      isFullyRefunded,
      transactionId: transaction.id
    });
  }

  /**
   * Calculate the refund delta from a charge.refunded event.
   * Uses previous_attributes to get the delta, not the cumulative amount_refunded.
   */
  private calculateRefundDelta(event: Stripe.ChargeRefundedEvent): number {
    const charge = event.data.object;
    const previousAttributes = event.data.previous_attributes as { amount_refunded?: number } | undefined;
    const previousAmountRefunded = previousAttributes?.amount_refunded ?? 0;
    return charge.amount_refunded - previousAmountRefunded;
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

    const count = await this.paymentMethodRepository.countByUserId(user.id);
    const isDefault = count === 0;

    assertIsPayingUser(user);

    await Promise.all([
      this.paymentMethodRepository.create({
        userId: user.id,
        fingerprint,
        paymentMethodId: paymentMethod.id,
        isDefault
      }),
      ...(isDefault ? [this.stripe.markRemotePaymentMethodAsDefault(paymentMethod.id, user)] : [])
    ]);

    this.logger.info({
      event: "PAYMENT_METHOD_ATTACHED",
      paymentMethodId: paymentMethod.id,
      userId: user.id,
      isDefault
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
}
