import type { LoggerService } from "@akashnetwork/logging";
import { stringify } from "csv-stringify";
import keyBy from "lodash/keyBy";
import { Readable } from "stream";
import Stripe from "stripe";
import { inject, singleton } from "tsyringe";

import { Transaction } from "@src/billing/http-schemas/stripe.schema";
import { STRIPE_CLIENT } from "@src/billing/providers/stripe-client.provider";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { TransactionCsvRow } from "@src/types/transactions";

@singleton()
export class TransactionReportingService {
  private readonly loggerService: LoggerService;

  constructor(
    @inject(STRIPE_CLIENT) private readonly stripe: Stripe,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: TransactionReportingService.name });
  }

  async getCustomerTransactions(
    customerId: string,
    options?: { limit?: number; startingAfter?: string; endingBefore?: string; startDate?: string; endDate?: string }
  ): Promise<{
    transactions: Transaction[];
    hasMore: boolean;
    nextPage: string | null;
    prevPage: string | null;
  }> {
    const created =
      options?.startDate || options?.endDate
        ? {
            gte: options?.startDate ? Math.floor(new Date(options.startDate).getTime() / 1000) : undefined,
            lte: options?.endDate ? Math.floor(new Date(options.endDate).getTime() / 1000) : undefined
          }
        : undefined;

    const charges = await this.stripe.charges.list({
      created,
      customer: customerId,
      limit: options?.limit ?? 100,
      starting_after: options?.startingAfter,
      ending_before: options?.endingBefore,
      expand: ["data.payment_intent"]
    });

    const internalTransactions = await this.stripeTransactionRepository.findByChargeIds(charges.data.map(charge => charge.id));
    const internalByChargeId = keyBy(internalTransactions, "stripeChargeId");

    const transactions = charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      bonusAmount: internalByChargeId[charge.id]?.bonusAmount ?? 0,
      currency: charge.currency,
      status: charge.status,
      created: charge.created,
      paymentMethod: charge.payment_method_details
        ? {
            ...charge.payment_method_details,
            link: charge.payment_method_details.link ? { email: undefined } : undefined
          }
        : null,
      receiptUrl: charge.receipt_url,
      description: charge.description,
      metadata: charge.metadata
    }));

    return {
      transactions,
      hasMore: charges.has_more,
      nextPage: charges.has_more ? charges.data[charges.data.length - 1]?.id ?? null : null,
      prevPage: options?.startingAfter ? charges.data[0]?.id ?? null : null
    };
  }

  async *exportTransactionsCsvStream(customerId: string, options: { startDate: string; endDate: string; timezone: string }): AsyncIterable<string> {
    const normalizedTimezone = this.normalizeTimeZone(options.timezone);
    const transactionGenerator = this.createTransactionGenerator(customerId, {
      ...options,
      timezone: normalizedTimezone
    });

    const csvStringifier = stringify({
      header: true,
      bom: true,
      columns: [
        { key: "id", header: "Transaction ID" },
        { key: "date", header: `Date (${normalizedTimezone})` },
        { key: "amount", header: "Amount" },
        { key: "bonusAmount", header: "Bonus" },
        { key: "currency", header: "Currency" },
        { key: "status", header: "Status" },
        { key: "paymentMethodType", header: "Payment Method" },
        { key: "cardBrand", header: "Card Brand" },
        { key: "cardLast4", header: "Card Last 4" },
        { key: "description", header: "Description" },
        { key: "receiptUrl", header: "Receipt URL" }
      ]
    });

    const sourceStream = Readable.from(transactionGenerator);

    const csvStream = sourceStream.pipe(csvStringifier);

    try {
      for await (const chunk of csvStream) {
        yield typeof chunk === "string" ? chunk : (chunk as Buffer).toString("utf8");
      }
    } catch (error) {
      this.loggerService.error({ event: "CSV_STREAM_ERROR", error });
      throw error;
    }
  }

  private async *createTransactionGenerator(
    customerId: string,
    options: { startDate: string; endDate: string; timezone: string }
  ): AsyncGenerator<TransactionCsvRow, void, unknown> {
    let hasMore = true;
    let startingAfter: string | undefined;
    const batchSize = 100;
    let hasYieldedAny = false;

    while (hasMore) {
      try {
        const batch = await this.getCustomerTransactions(customerId, {
          limit: batchSize,
          startingAfter,
          startDate: options.startDate,
          endDate: options.endDate
        });

        for (const transaction of batch.transactions) {
          hasYieldedAny = true;

          yield this.transformTransactionForCsv(transaction, options.timezone);
        }

        hasMore = batch.hasMore;
        startingAfter = batch.nextPage || undefined;
      } catch (error) {
        this.loggerService.error({ event: "TRANSACTION_FETCH_ERROR", error, customerId, startingAfter });
        yield {
          id: this.sanitizeForCsv("Error: unable to fetch transactions"),
          date: "",
          amount: "",
          bonusAmount: "",
          currency: "",
          status: "",
          paymentMethodType: "",
          cardBrand: "",
          cardLast4: "",
          description: "",
          receiptUrl: ""
        };
        hasMore = false;
      }
    }

    if (!hasYieldedAny) {
      yield {
        id: "No transactions found for the specified date range",
        date: "",
        amount: "",
        bonusAmount: "",
        currency: "",
        status: "",
        paymentMethodType: "",
        cardBrand: "",
        cardLast4: "",
        description: "",
        receiptUrl: ""
      };
    }
  }

  private sanitizeForCsv(value: string): string {
    if (!value) return "";

    if (/^[=+\-@]/.test(value)) {
      return "'" + value;
    }

    return value;
  }

  private transformTransactionForCsv(transaction: Transaction, timeZone: string) {
    const amount = (transaction.amount / 100).toFixed(2);
    const date = new Date(transaction.created * 1000).toLocaleString("en-CA", {
      timeZone
    });

    return {
      id: transaction.id,
      date,
      amount,
      bonusAmount: ((transaction.bonusAmount ?? 0) / 100).toFixed(2),
      currency: transaction.currency.toUpperCase(),
      status: transaction.status,
      paymentMethodType: transaction.paymentMethod?.type || "",
      cardBrand: transaction.paymentMethod?.card?.brand || "",
      cardLast4: transaction.paymentMethod?.card?.last4 || "",
      description: this.sanitizeForCsv(transaction.description || ""),
      receiptUrl: transaction.receiptUrl || ""
    };
  }

  private normalizeTimeZone(tz: string): string {
    if (Intl.supportedValuesOf("timeZone").includes(tz)) {
      return tz;
    }

    return "UTC";
  }
}
