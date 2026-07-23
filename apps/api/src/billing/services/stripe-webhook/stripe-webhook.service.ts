import { createOtelLogger } from "@akashnetwork/logging/otel";
import assert from "http-assert";
import Stripe from "stripe";
import { singleton } from "tsyringe";

import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import {
  PaymentMethodRepository,
  type StripeTransactionOutput,
  StripeTransactionRepository,
  TRIAL_PRESERVING_TRANSACTION_TYPES
} from "@src/billing/repositories";
import { assertIsPayingUser } from "@src/billing/services/paying-user/paying-user";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { WithTransaction } from "@src/core";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { UserRepository } from "@src/user/repositories";

@singleton()
export class StripeWebhookService {
  private readonly logger = createOtelLogger({ context: StripeWebhookService.name });

  constructor(
    private readonly stripe: StripeService,
    private readonly userRepository: UserRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly domainEventsService: DomainEventsService,
    private readonly stripeTransaction: StripeTransactionService
  ) {}

  async routeStripeEvent(signature: string, rawEvent: string) {
    const event = this.stripe.constructWebhookEvent(rawEvent, signature);
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
        case "invoice.paid":
        case "invoice.payment_succeeded":
          // invoice.paid covers out-of-band-paid invoices (e.g. admin-comped manual credits);
          // invoice.payment_succeeded covers charged invoices. Both credit the matching
          // pre-created transaction row idempotently (an already-succeeded row no-ops).
          await this.tryToTopUpWalletFromInvoice(event);
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

  async tryToTopUpWalletFromInvoice(event: Stripe.InvoicePaidEvent | Stripe.InvoicePaymentSucceededEvent) {
    const invoice = event.data.object;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;

    const transaction = await this.stripeTransactionRepository.findByInvoiceId(invoice.id);
    if (!transaction) {
      // Double-credit guard: ordinary charged invoices have no pre-created row (only the coupon-claim
      // and admin manual-credit paths pre-create one), so they no-op here.
      this.logger.info({
        event: "INVOICE_NO_MATCHING_TRANSACTION",
        invoiceId: invoice.id
      });
      return;
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

    await this.topUpWalletFromTransaction({
      customerId,
      transaction,
      chargeId,
      paymentMethodType: undefined,
      paymentAmount: transaction.amount,
      stripePaymentIntentId,
      eventDescription: `invoice ${invoice.id}`,
      endTrial
    });
  }

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

    const paymentAmount = paymentIntent.amount_received ?? paymentIntent.amount;

    await this.topUpWalletFromTransaction({
      customerId,
      transaction,
      chargeId,
      paymentMethodType: paymentIntent.payment_method_types?.[0],
      paymentAmount,
      stripePaymentIntentId: paymentIntent.id,
      eventDescription: `payment_intent ${paymentIntent.id}`
    });
  }

  private async topUpWalletFromTransaction(params: {
    customerId: string | null;
    transaction: StripeTransactionOutput;
    chargeId: string | undefined;
    paymentMethodType: string | undefined;
    paymentAmount: number;
    stripePaymentIntentId: string | undefined;
    eventDescription: string;
    endTrial?: boolean;
  }): Promise<void> {
    if (!params.customerId) {
      this.logger.error({
        event: "PAYMENT_MISSING_CUSTOMER_ID",
        description: params.eventDescription
      });
      return;
    }

    const user = await this.userRepository.findOneBy({ stripeCustomerId: params.customerId });
    if (!user) {
      this.logger.error({
        event: "USER_NOT_FOUND",
        customerId: params.customerId,
        description: params.eventDescription
      });
      return;
    }

    let cardBrand: string | undefined;
    let cardLast4: string | undefined;
    let receiptUrl: string | undefined;

    if (params.chargeId) {
      try {
        const charge = await this.stripe.retrieveCharge(params.chargeId);
        cardBrand = charge.payment_method_details?.card?.brand ?? undefined;
        cardLast4 = charge.payment_method_details?.card?.last4 ?? undefined;
        receiptUrl = charge.receipt_url ?? undefined;
      } catch (error) {
        this.logger.warn({
          event: "CHARGE_DETAILS_FETCH_FAILED",
          chargeId: params.chargeId,
          error
        });
      }
    }

    const bonusAmountCents = await this.stripeTransaction.settleSucceededTransaction({
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

    // Published here, not inside settleSucceededTransaction: this method is not transactional but that one is,
    // so the awaited call has committed by now and the bonus-granted email never fires on a rolled-back grant.
    if (bonusAmountCents > 0) {
      await this.domainEventsService.publish(new FirstPurchaseBonusGranted({ userId: user.id, bonusAmountCents, paidAmountCents: params.paymentAmount }));
    }
  }

  async handlePaymentIntentFailed(event: Stripe.PaymentIntentPaymentFailedEvent) {
    const paymentIntent = event.data.object;
    await this.stripeTransaction.markPaymentIntentFailed(paymentIntent.id, paymentIntent.last_payment_error?.message ?? "Payment failed");
  }

  async handlePaymentIntentCanceled(event: Stripe.PaymentIntentCanceledEvent) {
    await this.stripeTransaction.markPaymentIntentCanceled(event.data.object.id);
  }

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

    await this.stripeTransaction.applyRefund({
      chargeId: charge.id,
      amountRefunded: charge.amount_refunded,
      fullyRefunded: charge.refunded,
      userId: user.id
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

    assertIsPayingUser(user);

    const fingerprint = this.stripe.extractFingerprint(paymentMethod);
    if (!fingerprint) {
      this.logger.error({
        event: "PAYMENT_METHOD_MISSING_FINGERPRINT",
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
      });
      return;
    }

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
    const fingerprint = this.stripe.extractFingerprint(paymentMethod);

    this.logger.info({
      event: "PAYMENT_METHOD_DETACHED",
      paymentMethodId: paymentMethod.id,
      customerId,
      fingerprint
    });

    if (!fingerprint) {
      this.logger.warn({
        event: "PAYMENT_METHOD_DETACHED_NO_FINGERPRINT",
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
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
