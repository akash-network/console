import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import { CardPaymentInvoiceService, INVOICE_LINE_DESCRIPTION, NOT_INVOICEABLE_MESSAGE } from "./card-payment-invoice.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createTestInvoice, createTestPaymentIntent } from "@test/seeders/stripe-test-data.seeder";

describe(CardPaymentInvoiceService.name, () => {
  describe("issueInvoice", () => {
    it("issues an invoice dated at the payment and pays it with that payment", async () => {
      const { service, stripe, stripeTransactionRepository, logger } = setup();
      const transaction = createCardPayment({ amount: 2500 });
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(
        createTestPaymentIntent({ id: transaction.stripePaymentIntentId!, customer: "cus_buyer", currency: "usd", created: 1_760_000_000 })
      );
      const create = vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ id: "in_new", status: "draft", customer: "cus_buyer" }));
      const createItem = vi.spyOn(stripe.invoiceItems, "create").mockResolvedValue(mock<Stripe.Response<Stripe.InvoiceItem>>());
      const finalize = vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_new", status: "open" }));
      const paid = createTestInvoice({ id: "in_new", status: "paid" });
      const attachPayment = vi.spyOn(stripe.invoices, "attachPayment").mockResolvedValue(paid);

      const result = await service.issueInvoice(transaction);

      expect(result).toBe(paid);
      expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith(transaction.stripePaymentIntentId);
      expect(create).toHaveBeenCalledWith(
        {
          customer: "cus_buyer",
          currency: "usd",
          collection_method: "charge_automatically",
          auto_advance: false,
          pending_invoice_items_behavior: "exclude",
          effective_at: 1_760_000_000,
          metadata: { internal_transaction_id: transaction.id }
        },
        { idempotencyKey: `card-payment-invoice-${transaction.id}` }
      );
      expect(stripeTransactionRepository.updateById).toHaveBeenCalledWith(transaction.id, { stripeInvoiceId: "in_new" });
      expect(createItem).toHaveBeenCalledWith(
        { customer: "cus_buyer", invoice: "in_new", amount: 2500, currency: "usd", description: INVOICE_LINE_DESCRIPTION },
        { idempotencyKey: `card-payment-invoice-item-${transaction.id}` }
      );
      expect(finalize).toHaveBeenCalledWith("in_new", { auto_advance: false });
      expect(attachPayment).toHaveBeenCalledWith("in_new", { payment_intent: transaction.stripePaymentIntentId });
      expect(createItem.mock.invocationCallOrder[0]).toBeLessThan(finalize.mock.invocationCallOrder[0]);
      expect(finalize.mock.invocationCallOrder[0]).toBeLessThan(attachPayment.mock.invocationCallOrder[0]);
      expect(logger.info).toHaveBeenCalledWith({ event: "CARD_PAYMENT_INVOICE_ISSUED", transactionId: transaction.id, invoiceId: "in_new" });
    });

    it("invoices the customer of an expanded payment intent", async () => {
      const { service, stripe } = setup();
      const transaction = createCardPayment();
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(createTestPaymentIntent({ customer: mock<Stripe.Customer>({ id: "cus_expanded" }) }));
      const create = vi.spyOn(stripe.invoices, "create").mockResolvedValue(createTestInvoice({ status: "paid" }));

      await service.issueInvoice(transaction);

      expect(create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_expanded" }), expect.anything());
    });

    it("refuses to invoice a payment that has no Stripe customer", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.paymentIntents, "retrieve").mockResolvedValue(createTestPaymentIntent({ customer: null }));
      const create = vi.spyOn(stripe.invoices, "create");

      await expect(service.issueInvoice(createCardPayment())).rejects.toThrow("Payment has no Stripe customer to invoice");
      expect(create).not.toHaveBeenCalled();
    });

    it("returns the invoice already paid for the payment without changing it", async () => {
      const { service, stripe } = setup();
      const paid = createTestInvoice({ id: "in_paid", status: "paid" });
      const retrieve = vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(paid);
      const create = vi.spyOn(stripe.invoices, "create");
      const finalize = vi.spyOn(stripe.invoices, "finalizeInvoice");
      const attachPayment = vi.spyOn(stripe.invoices, "attachPayment");

      const result = await service.issueInvoice(createCardPayment({ stripeInvoiceId: "in_paid" }));

      expect(result).toBe(paid);
      expect(retrieve).toHaveBeenCalledWith("in_paid");
      expect(create).not.toHaveBeenCalled();
      expect(finalize).not.toHaveBeenCalled();
      expect(attachPayment).not.toHaveBeenCalled();
    });

    it("keeps serving the paid invoice of a payment refunded after it was issued", async () => {
      const { service, stripe } = setup();
      const paid = createTestInvoice({ id: "in_refunded", status: "paid" });
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(paid);

      const result = await service.issueInvoice(createCardPayment({ status: "refunded", stripeInvoiceId: "in_refunded" }));

      expect(result).toBe(paid);
    });

    it("refuses to finish the invoice of a payment refunded before it was paid", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_open", status: "open" }));
      const attachPayment = vi.spyOn(stripe.invoices, "attachPayment");

      await expect(service.issueInvoice(createCardPayment({ status: "refunded", stripeInvoiceId: "in_open" }))).rejects.toMatchObject({
        status: 400,
        message: NOT_INVOICEABLE_MESSAGE
      });
      expect(attachPayment).not.toHaveBeenCalled();
    });

    it("never looks up the invoice of a coupon claim", async () => {
      const { service, stripe } = setup();
      const retrieve = vi.spyOn(stripe.invoices, "retrieve");

      await expect(service.issueInvoice(createCardPayment({ type: "coupon_claim", stripeInvoiceId: "in_coupon" }))).rejects.toMatchObject({ status: 400 });
      expect(retrieve).not.toHaveBeenCalled();
    });

    it("pays an invoice an earlier attempt finalized but did not pay", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const transaction = createCardPayment({ stripeInvoiceId: "in_open" });
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_open", status: "open" }));
      const finalize = vi.spyOn(stripe.invoices, "finalizeInvoice");
      const attachPayment = vi.spyOn(stripe.invoices, "attachPayment").mockResolvedValue(createTestInvoice({ id: "in_open", status: "paid" }));

      await service.issueInvoice(transaction);

      expect(finalize).not.toHaveBeenCalled();
      expect(attachPayment).toHaveBeenCalledWith("in_open", { payment_intent: transaction.stripePaymentIntentId });
      expect(stripeTransactionRepository.updateById).not.toHaveBeenCalled();
    });

    it("finalizes a draft that already has its line without adding it again", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(
        createTestInvoice({ id: "in_draft", status: "draft", lines: { object: "list", data: [mock<Stripe.InvoiceLineItem>()], has_more: false, url: "" } })
      );
      const createItem = vi.spyOn(stripe.invoiceItems, "create");
      const finalize = vi.spyOn(stripe.invoices, "finalizeInvoice").mockResolvedValue(createTestInvoice({ id: "in_draft", status: "open" }));
      vi.spyOn(stripe.invoices, "attachPayment").mockResolvedValue(createTestInvoice({ id: "in_draft", status: "paid" }));

      await service.issueInvoice(createCardPayment({ stripeInvoiceId: "in_draft" }));

      expect(createItem).not.toHaveBeenCalled();
      expect(finalize).toHaveBeenCalledWith("in_draft", { auto_advance: false });
    });

    it("carries on from where a concurrent call left the invoice when Stripe refuses a step it already took", async () => {
      const { service, stripe } = setup();
      const transaction = createCardPayment({ stripeInvoiceId: "in_race" });
      vi.spyOn(stripe.invoices, "retrieve")
        .mockResolvedValueOnce(
          createTestInvoice({ id: "in_race", status: "draft", lines: { object: "list", data: [mock<Stripe.InvoiceLineItem>()], has_more: false, url: "" } })
        )
        .mockResolvedValueOnce(createTestInvoice({ id: "in_race", status: "open" }));
      vi.spyOn(stripe.invoices, "finalizeInvoice").mockRejectedValue(createInvalidRequestError("This invoice is already finalized"));
      const attachPayment = vi.spyOn(stripe.invoices, "attachPayment").mockResolvedValue(createTestInvoice({ id: "in_race", status: "paid" }));

      const result = await service.issueInvoice(transaction);

      expect(result.status).toBe("paid");
      expect(stripe.invoices.retrieve).toHaveBeenNthCalledWith(2, "in_race");
      expect(attachPayment).toHaveBeenCalledWith("in_race", { payment_intent: transaction.stripePaymentIntentId });
    });

    it("rethrows a refused step when the invoice has not moved on", async () => {
      const { service, stripe } = setup();
      const refusal = createInvalidRequestError("The PaymentIntent is already attached to another invoice");
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_stuck", status: "open" }));
      vi.spyOn(stripe.invoices, "attachPayment").mockRejectedValue(refusal);

      await expect(service.issueInvoice(createCardPayment({ stripeInvoiceId: "in_stuck" }))).rejects.toBe(refusal);
      expect(stripe.invoices.retrieve).toHaveBeenCalledTimes(2);
    });

    it("rethrows any other failure without reading the invoice again", async () => {
      const { service, stripe } = setup();
      const outage = new Stripe.errors.StripeAPIError({ type: "api_error", message: "Stripe is down" });
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_outage", status: "open" }));
      vi.spyOn(stripe.invoices, "attachPayment").mockRejectedValue(outage);

      await expect(service.issueInvoice(createCardPayment({ stripeInvoiceId: "in_outage" }))).rejects.toBe(outage);
      expect(stripe.invoices.retrieve).toHaveBeenCalledTimes(1);
    });

    it("fails when the payment leaves the invoice unpaid", async () => {
      const { service, stripe, logger } = setup();
      const transaction = createCardPayment({ stripeInvoiceId: "in_short" });
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_short", status: "open" }));
      vi.spyOn(stripe.invoices, "attachPayment").mockResolvedValue(createTestInvoice({ id: "in_short", status: "open" }));

      await expect(service.issueInvoice(transaction)).rejects.toThrow(`Invoice in_short for transaction ${transaction.id} ended up open instead of paid`);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("fails for an invoice that was voided", async () => {
      const { service, stripe } = setup();
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_void", status: "void" }));
      const attachPayment = vi.spyOn(stripe.invoices, "attachPayment");

      await expect(service.issueInvoice(createCardPayment({ stripeInvoiceId: "in_void" }))).rejects.toThrow("ended up void instead of paid");
      expect(attachPayment).not.toHaveBeenCalled();
    });

    it.each([
      { case: "a coupon claim", overrides: { type: "coupon_claim" as const } },
      { case: "a manual credit", overrides: { type: "manual_credit" as const } },
      { case: "a failed card payment", overrides: { status: "failed" as const } },
      { case: "a pending card payment", overrides: { status: "pending" as const } },
      { case: "a refunded card payment", overrides: { status: "refunded" as const } },
      { case: "a card payment with no payment intent", overrides: { stripePaymentIntentId: null } }
    ])("refuses to invoice $case", async ({ overrides }) => {
      const { service, stripe } = setup();
      const retrieve = vi.spyOn(stripe.paymentIntents, "retrieve");

      await expect(service.issueInvoice(createCardPayment(overrides))).rejects.toMatchObject({ status: 400, message: NOT_INVOICEABLE_MESSAGE });
      expect(retrieve).not.toHaveBeenCalled();
    });
  });

  describe("issueInvoiceForTransaction", () => {
    it("issues the invoice of the transaction it loads", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const transaction = createCardPayment({ stripeInvoiceId: "in_loaded" });
      stripeTransactionRepository.findById.mockResolvedValue(transaction);
      vi.spyOn(stripe.invoices, "retrieve").mockResolvedValue(createTestInvoice({ id: "in_loaded", status: "paid" }));

      const result = await service.issueInvoiceForTransaction(transaction.id);

      expect(stripeTransactionRepository.findById).toHaveBeenCalledWith(transaction.id);
      expect(result.id).toBe("in_loaded");
    });

    it("reports a transaction that does not exist", async () => {
      const { service, stripeTransactionRepository } = setup();
      stripeTransactionRepository.findById.mockResolvedValue(undefined);

      await expect(service.issueInvoiceForTransaction(faker.string.uuid())).rejects.toMatchObject({ status: 404, message: "Transaction not found" });
    });
  });

  function createCardPayment(overrides: Parameters<typeof generateDatabaseStripeTransaction>[0] = {}) {
    return generateDatabaseStripeTransaction({
      type: "payment_intent",
      status: "succeeded",
      stripePaymentIntentId: `pi_${faker.string.alphanumeric(14)}`,
      ...overrides
    });
  }

  function createInvalidRequestError(message: string) {
    return new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", message });
  }

  function setup() {
    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const logger = mock<LoggerService>();
    const service = new CardPaymentInvoiceService(stripe, stripeTransactionRepository, () => logger);

    return { service, stripe, stripeTransactionRepository, logger };
  }
});
