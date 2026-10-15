import createError from "http-errors";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";

export const INVOICE_LINE_DESCRIPTION = "Akash Console credits";

export const NOT_INVOICEABLE_MESSAGE = "Only a successful card payment can have an invoice";

type InvoiceableTransaction = StripeTransactionOutput & { stripePaymentIntentId: string };

@singleton()
export class CardPaymentInvoiceService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: CardPaymentInvoiceService.name });
  }

  async issueInvoiceForTransaction(transactionId: string): Promise<Stripe.Invoice> {
    const transaction = await this.stripeTransactionRepository.findById(transactionId);

    if (!transaction) {
      throw createError(404, "Transaction not found");
    }

    return await this.issueInvoice(transaction);
  }

  /** Every step reads where Stripe already is before acting, so a retried or concurrent call finishes the same invoice instead of opening a second one. */
  async issueInvoice(transaction: StripeTransactionOutput): Promise<Stripe.Invoice> {
    if (!isInvoiceable(transaction)) {
      throw createError(400, NOT_INVOICEABLE_MESSAGE);
    }

    let invoice = transaction.stripeInvoiceId ? await this.stripe.invoices.retrieve(transaction.stripeInvoiceId) : await this.#createDraft(transaction);

    if (invoice.status === "draft") {
      invoice = await this.#advance(invoice, () => this.#finalize(invoice, transaction));
    }

    if (invoice.status === "open") {
      invoice = await this.#advance(invoice, () => this.stripe.invoices.attachPayment(invoice.id, { payment_intent: transaction.stripePaymentIntentId }));
    }

    if (invoice.status !== "paid") {
      throw new Error(`Invoice ${invoice.id} for transaction ${transaction.id} ended up ${invoice.status} instead of paid`);
    }

    this.logger.info({ event: "CARD_PAYMENT_INVOICE_ISSUED", transactionId: transaction.id, invoiceId: invoice.id });

    return invoice;
  }

  /** The invoice is dated when the payment was made, and pending invoice items on the customer stay out of it. */
  async #createDraft(transaction: InvoiceableTransaction): Promise<Stripe.Invoice> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);
    const invoice = await this.stripe.invoices.create(
      {
        customer: idOf(paymentIntent.customer),
        currency: paymentIntent.currency,
        collection_method: "charge_automatically",
        auto_advance: false,
        pending_invoice_items_behavior: "exclude",
        effective_at: paymentIntent.created,
        metadata: { internal_transaction_id: transaction.id }
      },
      { idempotencyKey: `card-payment-invoice-${transaction.id}` }
    );

    await this.stripeTransactionRepository.updateById(transaction.id, { stripeInvoiceId: invoice.id });

    return invoice;
  }

  /** Finalized without auto-advance, so Stripe never tries to charge the card a second time for an invoice the payment already covers. */
  async #finalize(invoice: Stripe.Invoice, transaction: InvoiceableTransaction): Promise<Stripe.Invoice> {
    if (!invoice.lines.data.length) {
      await this.stripe.invoiceItems.create(
        {
          customer: idOf(invoice.customer),
          invoice: invoice.id,
          amount: transaction.amount,
          currency: transaction.currency,
          description: INVOICE_LINE_DESCRIPTION
        },
        { idempotencyKey: `card-payment-invoice-item-${transaction.id}` }
      );
    }

    return await this.stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: false });
  }

  /** A concurrent call may have taken the step first, which Stripe refuses as an invalid request; the invoice it moved on is then used instead. */
  async #advance(invoice: Stripe.Invoice, step: () => Promise<Stripe.Invoice>): Promise<Stripe.Invoice> {
    try {
      return await step();
    } catch (error) {
      if (!(error instanceof Stripe.errors.StripeInvalidRequestError)) {
        throw error;
      }

      const current = await this.stripe.invoices.retrieve(invoice.id);

      if (current.status === invoice.status) {
        throw error;
      }

      return current;
    }
  }
}

function isInvoiceable(transaction: StripeTransactionOutput): transaction is InvoiceableTransaction {
  return transaction.type === "payment_intent" && transaction.status === "succeeded" && !!transaction.stripePaymentIntentId;
}

function idOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string {
  if (!customer) {
    throw new Error("Payment has no Stripe customer to invoice");
  }

  return typeof customer === "string" ? customer : customer.id;
}
