import assert from "http-assert";
import { createOtelLogger } from "@akashnetwork/logging/otel";
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
  private readonly logger = createOtelLogger({ context: StripeWebhookService.name });

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

    if (paymentIntent.metadata.type === "payment_method_validation") {
      this.logger.info({
        event: "SKIP_PAYMENT_METHOD_VALIDATION_PROCESSING",
        paymentIntentId: paymentIntent.id
      });
      return;
    }

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

    // Check if this payment was already processed (idempotency for Stripe webhook retries)
    const existingTransaction = paymentIntent.metadata.internal_transaction_id
      ? await this.stripeTransactionRepository.findById(paymentIntent.metadata.internal_transaction_id)
      : await this.stripeTransactionRepository.findByPaymentIntentId(paymentIntent.id);

    assert(existingTransaction, 500, "Failed to find existing transaction for payment intent", {
      paymentIntentId: paymentIntent.id,
      stripeTransactionId: paymentIntent.metadata.internal_transaction_id
    });

    if (existingTransaction?.status === "succeeded") {
      this.logger.info({
        event: "PAYMENT_ALREADY_PROCESSED",
        paymentIntentId: paymentIntent.id,
        transactionId: existingTransaction.id
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

    await this.stripeTransactionRepository.updateById(existingTransaction.id, {
      status: "succeeded",
      stripeChargeId: chargeId,
      paymentMethodType: paymentMethodDetails,
      cardBrand,
      cardLast4,
      receiptUrl,
      stripePaymentIntentId: paymentIntent.id
    });

    // Use amount_received when available (for partial captures), otherwise use amount
    const paymentAmount = paymentIntent.amount_received ?? paymentIntent.amount;
    await this.refillService.topUpWallet(paymentAmount, user.id);
  }

  @WithTransaction()
  async handlePaymentIntentFailed(event: Stripe.PaymentIntentPaymentFailedEvent) {
    const paymentIntent = event.data.object;
    const errorMessage = paymentIntent.last_payment_error?.message ?? "Payment failed";

    await this.stripeTransactionRepository.updateByPaymentIntentId(paymentIntent.id, {
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

    await this.stripeTransactionRepository.updateByPaymentIntentId(paymentIntent.id, {
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

    // Idempotency check: if we've already processed up to this refund amount, skip
    if (transaction.amountRefunded >= charge.amount_refunded) {
      this.logger.info({
        event: "CHARGE_REFUND_ALREADY_PROCESSED",
        chargeId: charge.id,
        transactionId: transaction.id,
        storedAmountRefunded: transaction.amountRefunded,
        incomingAmountRefunded: charge.amount_refunded
      });
      return;
    }

    // Calculate delta based on what we've already processed, not previous_attributes
    // This handles both retries and partial refunds correctly
    const refundedAmount = charge.amount_refunded - transaction.amountRefunded;
    if (refundedAmount <= 0) {
      this.logger.warn({ event: "CHARGE_REFUNDED_NO_DELTA", chargeId: charge.id, totalRefunded: charge.amount_refunded });
      return;
    }

    // Only reduce wallet balance if the transaction was successful (user actually received credits)
    if (transaction.status !== "succeeded" && transaction.status !== "refunded") {
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

    // Update transaction with new refund amount and status
    await this.stripeTransactionRepository.updateById(transaction.id, {
      amountRefunded: charge.amount_refunded,
      ...(isFullyRefunded ? { status: "refunded" } : {})
    });

    await this.refillService.reduceWalletBalance(refundedAmount, user.id);

    this.logger.info({
      event: "CHARGE_REFUNDED",
      chargeId: charge.id,
      userId: user.id,
      refundedAmount,
      totalRefunded: charge.amount_refunded,
      previouslyRefunded: transaction.amountRefunded,
      isFullyRefunded,
      transactionId: transaction.id
    });
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

    assertIsPayingUser(user);

    // Use upsert for idempotency - handles Stripe webhook retries gracefully
    const { paymentMethod: localPaymentMethod, isNew } = await this.paymentMethodRepository.upsert({
      userId: user.id,
      fingerprint,
      paymentMethodId: paymentMethod.id
    });

    // Only set as default on Stripe if newly created AND is the first payment method (default)
    if (isNew && localPaymentMethod.isDefault) {
      try {
        await this.stripe.markRemotePaymentMethodAsDefault(paymentMethod.id, user);
      } catch (error) {
        // Log but don't fail - local record exists, Stripe sync can be retried manually if needed
        this.logger.warn({
          event: "STRIPE_DEFAULT_PAYMENT_METHOD_SYNC_FAILED",
          paymentMethodId: paymentMethod.id,
          userId: user.id,
          error
        });
      }
    }

    this.logger.info({
      event: "PAYMENT_METHOD_ATTACHED",
      paymentMethodId: paymentMethod.id,
      userId: user.id,
      isDefault: localPaymentMethod.isDefault,
      wasAlreadyProcessed: !isNew
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
