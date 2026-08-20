import { createOtelLogger } from "@akashnetwork/logging/otel";
import { singleton } from "tsyringe";

import { AutoRechargeSucceeded } from "@src/billing/events/auto-recharge-succeeded";
import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { type SettlementOutcome, StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";

@singleton()
export class StripeWebhookService {
  private readonly logger = createOtelLogger({ context: StripeWebhookService.name });

  constructor(
    private readonly stripe: StripeService,
    private readonly stripeTransaction: StripeTransactionService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly domainEventsService: DomainEventsService
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
      let outcome: SettlementOutcome = {};

      switch (event.type) {
        case "payment_intent.succeeded":
          outcome = await this.stripeTransaction.settlePaymentIntent(event);
          break;
        case "invoice.paid":
        case "invoice.payment_succeeded":
          // invoice.paid covers out-of-band-paid invoices (e.g. admin-comped manual credits);
          // invoice.payment_succeeded covers charged invoices. Both credit the matching
          // pre-created transaction row idempotently (an already-succeeded row no-ops).
          outcome = await this.stripeTransaction.settleInvoice(event);
          break;
        case "payment_intent.payment_failed":
          await this.stripeTransaction.failPaymentIntent(event);
          break;
        case "payment_intent.canceled":
          await this.stripeTransaction.cancelPaymentIntent(event);
          break;
        case "charge.refunded":
          await this.stripeTransaction.refundCharge(event);
          break;
        case "payment_method.attached":
          await this.paymentMethodService.syncAttachedFromEvent(event);
          break;
        case "payment_method.detached":
          await this.paymentMethodService.removeDetachedFromEvent(event);
          break;
      }

      // Published after the settling transaction has committed so neither email fires on a rolled-back credit.
      if (outcome.bonusGrant) {
        await this.domainEventsService.publish(new FirstPurchaseBonusGranted(outcome.bonusGrant));
      }
      if (outcome.autoRecharge) {
        await this.domainEventsService.publish(new AutoRechargeSucceeded(outcome.autoRecharge));
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
}
