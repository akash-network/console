import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
import type { TransactionInvoiceResponse } from "@src/billing/http-schemas/transaction-invoice.schema";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { CardPaymentInvoiceService } from "@src/billing/services/card-payment-invoice/card-payment-invoice.service";
import { billingOwnerOf } from "@src/billing/services/payer/payer";
import { PayerService } from "@src/billing/services/payer/payer.service";

@singleton()
export class TransactionInvoiceController {
  constructor(
    private readonly authService: AuthService,
    private readonly payerService: PayerService,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly cardPaymentInvoiceService: CardPaymentInvoiceService
  ) {}

  /** Anyone who reads the billing history may download an invoice, but only those who may pay can have a missing one issued. */
  @Protected([{ action: "read", subject: "StripePayment" }])
  async getInvoice(transactionId: string): Promise<TransactionInvoiceResponse> {
    const payer = await this.payerService.getCurrentPayer();
    const transaction = await this.stripeTransactionRepository.findOwnedById(transactionId, billingOwnerOf(payer));

    assert(transaction, 404, "Transaction not found");

    if (!transaction.stripeInvoiceId) {
      this.authService.throwUnlessCan("create", "StripePayment");
    }

    const invoice = await this.cardPaymentInvoiceService.issueInvoice(transaction);

    return { data: { invoiceId: invoice.id, invoicePdfUrl: invoice.invoice_pdf ?? null } };
  }
}
