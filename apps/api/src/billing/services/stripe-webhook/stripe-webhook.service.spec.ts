import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { FirstPurchaseBonusGranted } from "@src/billing/events/first-purchase-bonus-granted";
import type { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import type { StripeTransactionService } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import { StripeWebhookService } from "@src/billing/services/stripe-webhook/stripe-webhook.service";
import type { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";

describe(StripeWebhookService.name, () => {
  describe("routeStripeEvent", () => {
    it("verifies the signature against the raw body before dispatching", async () => {
      const { service, stripe } = setup("payment_intent.succeeded");

      await service.routeStripeEvent("sig_1", "raw-body");

      expect(stripe.constructWebhookEvent).toHaveBeenCalledWith("raw-body", "sig_1");
    });

    it("routes payment_intent.succeeded to settlePaymentIntent", async () => {
      const { service, event, stripeTransaction } = setup("payment_intent.succeeded");

      await service.routeStripeEvent("sig", "body");

      expect(stripeTransaction.settlePaymentIntent).toHaveBeenCalledWith(event);
    });

    it.each(["invoice.paid", "invoice.payment_succeeded"] as const)("routes %s to settleInvoice", async type => {
      const { service, event, stripeTransaction } = setup(type);

      await service.routeStripeEvent("sig", "body");

      expect(stripeTransaction.settleInvoice).toHaveBeenCalledWith(event);
    });

    it("routes payment_intent.payment_failed to failPaymentIntent", async () => {
      const { service, event, stripeTransaction } = setup("payment_intent.payment_failed");

      await service.routeStripeEvent("sig", "body");

      expect(stripeTransaction.failPaymentIntent).toHaveBeenCalledWith(event);
    });

    it("routes payment_intent.canceled to cancelPaymentIntent", async () => {
      const { service, event, stripeTransaction } = setup("payment_intent.canceled");

      await service.routeStripeEvent("sig", "body");

      expect(stripeTransaction.cancelPaymentIntent).toHaveBeenCalledWith(event);
    });

    it("routes charge.refunded to refundCharge", async () => {
      const { service, event, stripeTransaction } = setup("charge.refunded");

      await service.routeStripeEvent("sig", "body");

      expect(stripeTransaction.refundCharge).toHaveBeenCalledWith(event);
    });

    it("routes payment_method.attached to syncAttachedFromEvent", async () => {
      const { service, event, paymentMethodService } = setup("payment_method.attached");

      await service.routeStripeEvent("sig", "body");

      expect(paymentMethodService.syncAttachedFromEvent).toHaveBeenCalledWith(event);
    });

    it("routes payment_method.detached to removeDetachedFromEvent", async () => {
      const { service, event, paymentMethodService } = setup("payment_method.detached");

      await service.routeStripeEvent("sig", "body");

      expect(paymentMethodService.removeDetachedFromEvent).toHaveBeenCalledWith(event);
    });

    it("publishes a first-purchase bonus event when settlePaymentIntent grants one", async () => {
      const { service, stripeTransaction, domainEventsService } = setup("payment_intent.succeeded");
      const grant = { userId: "user_1", bonusAmountCents: 1500, paidAmountCents: 15000 };
      stripeTransaction.settlePaymentIntent.mockResolvedValue(grant);

      await service.routeStripeEvent("sig", "body");

      expect(domainEventsService.publish).toHaveBeenCalledWith(new FirstPurchaseBonusGranted(grant));
    });

    it("publishes a first-purchase bonus event when settleInvoice grants one", async () => {
      const { service, stripeTransaction, domainEventsService } = setup("invoice.paid");
      const grant = { userId: "user_1", bonusAmountCents: 1000, paidAmountCents: 10000 };
      stripeTransaction.settleInvoice.mockResolvedValue(grant);

      await service.routeStripeEvent("sig", "body");

      expect(domainEventsService.publish).toHaveBeenCalledWith(new FirstPurchaseBonusGranted(grant));
    });

    it("does not publish when the settlement returns no grant", async () => {
      const { service, stripeTransaction, domainEventsService } = setup("payment_intent.succeeded");
      stripeTransaction.settlePaymentIntent.mockResolvedValue(undefined);

      await service.routeStripeEvent("sig", "body");

      expect(domainEventsService.publish).not.toHaveBeenCalled();
    });

    it("rethrows when a handler fails", async () => {
      const { service, stripeTransaction } = setup("charge.refunded");
      const error = new Error("boom");
      stripeTransaction.refundCharge.mockRejectedValue(error);

      await expect(service.routeStripeEvent("sig", "body")).rejects.toBe(error);
    });
  });

  function setup(type: Stripe.Event["type"]) {
    const stripe = mock<StripeService>();
    const stripeTransaction = mock<StripeTransactionService>();
    const paymentMethodService = mock<PaymentMethodService>();
    const domainEventsService = mock<DomainEventsService>();

    const event = { id: "evt_1", type, data: { object: { object: "obj" } } } as unknown as Stripe.Event;
    stripe.constructWebhookEvent.mockReturnValue(event);

    const service = new StripeWebhookService(stripe, stripeTransaction, paymentMethodService, domainEventsService);

    return { service, event, stripe, stripeTransaction, paymentMethodService, domainEventsService };
  }
});
