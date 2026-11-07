import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { AUTO_RECHARGE_METADATA_KEY } from "@src/billing/services/stripe-transaction/stripe-transaction.service";
import {
  MAX_REFUSALS_PER_WINDOW,
  PAYMENT_METHOD_REFUSED_ERROR_CODE,
  PaymentRefusalService,
  PAYMENTS_PAUSED_ERROR_CODE,
  REFUSAL_WINDOW_MS,
  REFUSALS_PER_PAYMENT_METHOD
} from "./payment-refusal.service";

import { createTestPaymentIntent } from "@test/seeders/stripe-test-data.seeder";

describe(PaymentRefusalService.name, () => {
  describe("findRecentRefusals", () => {
    it("lists the customer's payments made within the refusal window", async () => {
      const { service, stripe, customerId } = setup({ paymentIntents: [] });
      const windowStartsAt = Math.floor((Date.now() - REFUSAL_WINDOW_MS) / 1000);

      await service.findRecentRefusals(customerId);

      expect(stripe.paymentIntents.list).toHaveBeenCalledWith({
        customer: customerId,
        created: { gt: expect.closeTo(windowStartsAt, 0) },
        limit: 100
      });
    });

    it("returns no refusals when no recent payment was refused", async () => {
      const { service, customerId } = setup({ paymentIntents: [succeeded({ secondsAgo: 60 })] });

      expect(await service.findRecentRefusals(customerId)).toEqual({ refusedPaymentMethodIds: [], pausedUntil: null });
    });

    it("reports a payment method once it has been refused repeatedly", async () => {
      const refusedMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const otherMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: [
          ...Array.from({ length: REFUSALS_PER_PAYMENT_METHOD }, (_, index) => refused({ paymentMethodId: refusedMethodId, secondsAgo: 60 + index })),
          ...Array.from({ length: REFUSALS_PER_PAYMENT_METHOD - 1 }, (_, index) => refused({ paymentMethodId: otherMethodId, secondsAgo: 120 + index }))
        ]
      });

      const { refusedPaymentMethodIds } = await service.findRecentRefusals(customerId);

      expect(refusedPaymentMethodIds).toEqual([refusedMethodId]);
    });

    it("reads the refused payment method off the intent when the payment error does not name it", async () => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: REFUSALS_PER_PAYMENT_METHOD }, (_, index) =>
          createTestPaymentIntent({
            status: "requires_payment_method",
            created: secondsAgo(60 + index),
            payment_method: paymentMethodId,
            last_payment_error: { type: "card_error", code: "card_declined" }
          })
        )
      });

      const { refusedPaymentMethodIds } = await service.findRecentRefusals(customerId);

      expect(refusedPaymentMethodIds).toEqual([paymentMethodId]);
    });

    it("ignores refusals of automatic recharges", async () => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: MAX_REFUSALS_PER_WINDOW }, (_, index) =>
          refused({ paymentMethodId, secondsAgo: 60 + index, metadata: { [AUTO_RECHARGE_METADATA_KEY]: "true" } })
        )
      });

      expect(await service.findRecentRefusals(customerId)).toEqual({ refusedPaymentMethodIds: [], pausedUntil: null });
    });

    it("forgets refusals once a later payment succeeds", async () => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: [
          succeeded({ secondsAgo: 30 }),
          ...Array.from({ length: MAX_REFUSALS_PER_WINDOW }, (_, index) => refused({ paymentMethodId, secondsAgo: 60 + index }))
        ]
      });

      expect(await service.findRecentRefusals(customerId)).toEqual({ refusedPaymentMethodIds: [], pausedUntil: null });
    });

    it("keeps refusals that came after the last successful payment", async () => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: [
          ...Array.from({ length: REFUSALS_PER_PAYMENT_METHOD }, (_, index) => refused({ paymentMethodId, secondsAgo: 60 + index })),
          succeeded({ secondsAgo: 600 })
        ]
      });

      const { refusedPaymentMethodIds } = await service.findRecentRefusals(customerId);

      expect(refusedPaymentMethodIds).toEqual([paymentMethodId]);
    });

    it("ignores payments that are still awaiting the customer without a refusal", async () => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: MAX_REFUSALS_PER_WINDOW }, (_, index) =>
          createTestPaymentIntent({ status: "requires_action", created: secondsAgo(60 + index), payment_method: paymentMethodId })
        )
      });

      expect(await service.findRecentRefusals(customerId)).toEqual({ refusedPaymentMethodIds: [], pausedUntil: null });
    });

    it("pauses payments until the earliest of the latest refusals leaves the window", async () => {
      const refusalAges = Array.from({ length: MAX_REFUSALS_PER_WINDOW + 1 }, (_, index) => 60 * (index + 1));
      const { service, customerId } = setup({
        paymentIntents: refusalAges.map(age => refused({ paymentMethodId: `pm_${faker.string.alphanumeric(10)}`, secondsAgo: age }))
      });
      const earliestCountedRefusalAt = secondsAgo(refusalAges[MAX_REFUSALS_PER_WINDOW - 1]) * 1000;

      const { pausedUntil } = await service.findRecentRefusals(customerId);

      expect(pausedUntil).toEqual(new Date(earliestCountedRefusalAt + REFUSAL_WINDOW_MS));
    });

    it("does not pause payments before enough refusals add up", async () => {
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: MAX_REFUSALS_PER_WINDOW - 1 }, (_, index) =>
          refused({ paymentMethodId: `pm_${faker.string.alphanumeric(10)}`, secondsAgo: 60 + index })
        )
      });

      const { pausedUntil } = await service.findRecentRefusals(customerId);

      expect(pausedUntil).toBeNull();
    });

    it("counts a refusal without a known payment method towards the pause", async () => {
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: MAX_REFUSALS_PER_WINDOW }, (_, index) =>
          createTestPaymentIntent({
            status: "requires_payment_method",
            created: secondsAgo(60 + index),
            payment_method: null,
            last_payment_error: { type: "card_error", code: "card_declined" }
          })
        )
      });

      const { refusedPaymentMethodIds, pausedUntil } = await service.findRecentRefusals(customerId);

      expect(refusedPaymentMethodIds).toEqual([]);
      expect(pausedUntil).not.toBeNull();
    });
  });

  describe("assertMayCharge", () => {
    it("allows a payment method that was not refused recently", async () => {
      const refusedMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: REFUSALS_PER_PAYMENT_METHOD }, (_, index) => refused({ paymentMethodId: refusedMethodId, secondsAgo: 60 + index }))
      });

      await expect(service.assertMayCharge(customerId, `pm_${faker.string.alphanumeric(10)}`)).resolves.toBeUndefined();
    });

    it("refuses a payment method the bank refused repeatedly", async () => {
      const paymentMethodId = `pm_${faker.string.alphanumeric(10)}`;
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: REFUSALS_PER_PAYMENT_METHOD }, (_, index) => refused({ paymentMethodId, secondsAgo: 60 + index }))
      });

      await expect(service.assertMayCharge(customerId, paymentMethodId)).rejects.toMatchObject({
        status: 402,
        errorCode: PAYMENT_METHOD_REFUSED_ERROR_CODE,
        errorType: "payment_error"
      });
    });

    it("refuses every payment method while payments are paused and says when to retry", async () => {
      const { service, customerId } = setup({
        paymentIntents: Array.from({ length: MAX_REFUSALS_PER_WINDOW }, (_, index) =>
          refused({ paymentMethodId: `pm_${faker.string.alphanumeric(10)}`, secondsAgo: 60 + index })
        )
      });

      const error = await service.assertMayCharge(customerId, `pm_${faker.string.alphanumeric(10)}`).catch(caught => caught);

      expect(error).toMatchObject({ status: 429, errorCode: PAYMENTS_PAUSED_ERROR_CODE, errorType: "payment_error" });
      const retryAfterSeconds = Number(error.headers["Retry-After"]);
      expect(retryAfterSeconds).toBeGreaterThan(0);
      expect(retryAfterSeconds).toBeLessThanOrEqual(REFUSAL_WINDOW_MS / 1000);
    });
  });

  function secondsAgo(seconds: number): number {
    return Math.floor(Date.now() / 1000) - seconds;
  }

  function refused(input: { paymentMethodId: string; secondsAgo: number; metadata?: Record<string, string> }) {
    return createTestPaymentIntent({
      id: `pi_${faker.string.alphanumeric(14)}`,
      status: "requires_payment_method",
      created: secondsAgo(input.secondsAgo),
      payment_method: null,
      metadata: input.metadata ?? {},
      last_payment_error: { type: "card_error", code: "card_declined", payment_method: { id: input.paymentMethodId } as Stripe.PaymentMethod }
    });
  }

  function succeeded(input: { secondsAgo: number }) {
    return createTestPaymentIntent({
      id: `pi_${faker.string.alphanumeric(14)}`,
      status: "succeeded",
      created: secondsAgo(input.secondsAgo),
      payment_method: `pm_${faker.string.alphanumeric(10)}`
    });
  }

  function setup(input: { paymentIntents: Stripe.PaymentIntent[] }) {
    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    vi.spyOn(stripe.paymentIntents, "list").mockResolvedValue({
      object: "list",
      data: input.paymentIntents,
      has_more: false,
      url: "/v1/payment_intents",
      lastResponse: { headers: {}, requestId: "req_test", statusCode: 200 }
    });
    const service = new PaymentRefusalService(stripe);
    const customerId = `cus_${faker.string.alphanumeric(14)}`;

    return { service, stripe, customerId };
  }
});
