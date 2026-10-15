import createError from "http-errors";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { CardPaymentInvoiceService } from "@src/billing/services/card-payment-invoice/card-payment-invoice.service";
import type { PayerService } from "@src/billing/services/payer/payer.service";
import { TransactionInvoiceController } from "./transaction-invoice.controller";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createTeamPayer } from "@test/seeders/payer.seeder";
import { createTestInvoice } from "@test/seeders/stripe-test-data.seeder";

describe(TransactionInvoiceController.name, () => {
  describe("getInvoice", () => {
    it("issues the invoice of a payment of the current payer and returns its PDF", async () => {
      const { controller, stripeTransactionRepository, cardPaymentInvoiceService, authService, payer } = setup();
      const transaction = generateDatabaseStripeTransaction({ status: "succeeded" });
      stripeTransactionRepository.findOwnedById.mockResolvedValue(transaction);
      cardPaymentInvoiceService.issueInvoice.mockResolvedValue(createTestInvoice({ id: "in_1", invoice_pdf: "https://pay.stripe.com/pdf" }));

      const result = await controller.getInvoice(transaction.id);

      expect(stripeTransactionRepository.findOwnedById).toHaveBeenCalledWith(transaction.id, { organizationId: payer.team!.id });
      expect(authService.throwUnlessCan).toHaveBeenCalledWith("create", "StripePayment");
      expect(cardPaymentInvoiceService.issueInvoice).toHaveBeenCalledWith(transaction);
      expect(result).toEqual({ data: { invoiceId: "in_1", invoicePdfUrl: "https://pay.stripe.com/pdf" } });
    });

    it("returns no PDF link for an invoice Stripe has none for", async () => {
      const { controller, stripeTransactionRepository, cardPaymentInvoiceService } = setup();
      stripeTransactionRepository.findOwnedById.mockResolvedValue(generateDatabaseStripeTransaction({ stripeInvoiceId: "in_1" }));
      cardPaymentInvoiceService.issueInvoice.mockResolvedValue(createTestInvoice({ id: "in_1", invoice_pdf: null }));

      const result = await controller.getInvoice("tx-1");

      expect(result.data.invoicePdfUrl).toBeNull();
    });

    it("lets a reader download an invoice the payment already has", async () => {
      const { controller, stripeTransactionRepository, cardPaymentInvoiceService, authService } = setup({ deniedRule: "create:StripePayment" });
      const transaction = generateDatabaseStripeTransaction({ stripeInvoiceId: "in_existing" });
      stripeTransactionRepository.findOwnedById.mockResolvedValue(transaction);
      cardPaymentInvoiceService.issueInvoice.mockResolvedValue(createTestInvoice({ id: "in_existing" }));

      await controller.getInvoice(transaction.id);

      expect(authService.throwUnlessCan).not.toHaveBeenCalledWith("create", "StripePayment");
      expect(cardPaymentInvoiceService.issueInvoice).toHaveBeenCalledWith(transaction);
    });

    it("refuses a reader who asks for an invoice the payment does not have yet", async () => {
      const { controller, stripeTransactionRepository, cardPaymentInvoiceService } = setup({ deniedRule: "create:StripePayment" });
      stripeTransactionRepository.findOwnedById.mockResolvedValue(generateDatabaseStripeTransaction({ stripeInvoiceId: null }));

      await expect(controller.getInvoice("tx-1")).rejects.toMatchObject({ status: 403 });
      expect(cardPaymentInvoiceService.issueInvoice).not.toHaveBeenCalled();
    });

    it("reports a transaction the current payer does not own", async () => {
      const { controller, stripeTransactionRepository, cardPaymentInvoiceService } = setup();
      stripeTransactionRepository.findOwnedById.mockResolvedValue(undefined);

      await expect(controller.getInvoice("tx-other")).rejects.toMatchObject({ status: 404, message: "Transaction not found" });
      expect(cardPaymentInvoiceService.issueInvoice).not.toHaveBeenCalled();
    });

    it("refuses a caller who cannot read the billing", async () => {
      const { controller, stripeTransactionRepository } = setup({ deniedRule: "read:StripePayment" });

      await expect(Promise.resolve().then(() => controller.getInvoice("tx-1"))).rejects.toMatchObject({ status: 403 });
      expect(stripeTransactionRepository.findOwnedById).not.toHaveBeenCalled();
    });
  });

  function setup(input: { deniedRule?: string } = {}) {
    const payer = createTeamPayer();
    const payerService = mock<PayerService>();
    payerService.getCurrentPayer.mockResolvedValue(payer);
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const cardPaymentInvoiceService = mock<CardPaymentInvoiceService>();
    const authService = mock<AuthService>({ isAuthenticated: true });
    authService.throwUnlessCan.mockImplementation((action, subject) => {
      if (`${action}:${subject}` === input.deniedRule) {
        throw createError(403);
      }
    });
    container.register(AuthService, { useValue: authService });
    const controller = new TransactionInvoiceController(authService, payerService, stripeTransactionRepository, cardPaymentInvoiceService);

    return { controller, payerService, stripeTransactionRepository, cardPaymentInvoiceService, authService, payer };
  }
});
