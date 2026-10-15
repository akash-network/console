import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService, Protected } from "@src/auth/services/auth.service";
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

  /** Anyone who reads the billing history may download a paid invoice, but only those who may pay can have one issued or finished. */
  @Protected([{ action: "read", subject: "StripePayment" }])
  async getInvoicePdf(transactionId: string): Promise<ReadableStream<Uint8Array>> {
    const payer = await this.payerService.getCurrentPayer();
    const transaction = await this.stripeTransactionRepository.findOwnedById(transactionId, billingOwnerOf(payer));

    assert(transaction, 404, "Transaction not found");

    const paidInvoice = await this.cardPaymentInvoiceService.findPaidInvoice(transaction);

    if (!paidInvoice) {
      this.authService.throwUnlessCan("create", "StripePayment");
    }

    const invoice = paidInvoice ?? (await this.cardPaymentInvoiceService.issueInvoice(transaction));

    return await this.cardPaymentInvoiceService.fetchPdf(invoice);
  }
}
