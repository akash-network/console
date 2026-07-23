import type { LoggerService } from "@akashnetwork/logging";
import { stringify } from "csv-stringify";
import { Readable } from "stream";
import { inject, singleton } from "tsyringe";

import { Transaction } from "@src/billing/http-schemas/stripe.schema";
import { StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import type { TransactionCsvRow } from "@src/types/transactions";

@singleton()
export class TransactionReportingService {
  private readonly loggerService: LoggerService;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.loggerService = createLogger({ context: TransactionReportingService.name });
  }

  /**
   * Customer billing history sourced from our own `stripe_transactions` table rather than Stripe
   * charges, so it surfaces every transaction type (card payments, coupon claims, manual credits)
   * and refund state (`status: "refunded"`, `amountRefunded`) that a charge-only view cannot see.
   */
  async getCustomerTransactions(
    userId: string,
    options?: { limit?: number; offset?: number; startDate?: string; endDate?: string }
  ): Promise<{
    transactions: Transaction[];
    totalCount: number;
    hasMore: boolean;
  }> {
    const startDate = options?.startDate ? new Date(options.startDate) : undefined;
    const endDate = options?.endDate ? new Date(options.endDate) : undefined;
    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const [rows, totalCount] = await Promise.all([
      this.stripeTransactionRepository.findByUserId({ userId, startDate, endDate, limit, offset }),
      this.stripeTransactionRepository.countByUserId(userId, { startDate, endDate })
    ]);

    return {
      transactions: rows.map(row => this.toTransactionDto(row)),
      totalCount,
      hasMore: offset + rows.length < totalCount
    };
  }

  private toTransactionDto(row: StripeTransactionOutput): Transaction {
    return {
      id: row.id,
      type: row.type,
      amount: row.amount,
      amountRefunded: row.amountRefunded,
      bonusAmount: row.bonusAmount,
      currency: row.currency,
      status: row.status,
      created: Math.floor(row.createdAt.getTime() / 1000),
      cardBrand: row.cardBrand,
      cardLast4: row.cardLast4,
      stripeInvoiceId: row.stripeInvoiceId,
      receiptUrl: row.receiptUrl,
      description: row.description
    };
  }

  async *exportTransactionsCsvStream(userId: string, options: { startDate: string; endDate: string; timezone: string }): AsyncIterable<string> {
    const normalizedTimezone = this.normalizeTimeZone(options.timezone);
    const transactionGenerator = this.createTransactionGenerator(userId, {
      ...options,
      timezone: normalizedTimezone
    });

    const csvStringifier = stringify({
      header: true,
      bom: true,
      columns: [
        { key: "id", header: "Transaction ID" },
        { key: "date", header: `Date (${normalizedTimezone})` },
        { key: "type", header: "Type" },
        { key: "amount", header: "Amount" },
        { key: "bonusAmount", header: "Bonus" },
        { key: "amountRefunded", header: "Refunded" },
        { key: "currency", header: "Currency" },
        { key: "status", header: "Status" },
        { key: "cardBrand", header: "Card Brand" },
        { key: "cardLast4", header: "Card Last 4" },
        { key: "description", header: "Description" },
        { key: "invoiceId", header: "Invoice ID" },
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
    userId: string,
    options: { startDate: string; endDate: string; timezone: string }
  ): AsyncGenerator<TransactionCsvRow, void, unknown> {
    let hasMore = true;
    let offset = 0;
    const batchSize = 100;
    let hasYieldedAny = false;

    while (hasMore) {
      try {
        const batch = await this.getCustomerTransactions(userId, {
          limit: batchSize,
          offset,
          startDate: options.startDate,
          endDate: options.endDate
        });

        for (const transaction of batch.transactions) {
          hasYieldedAny = true;

          yield this.transformTransactionForCsv(transaction, options.timezone);
        }

        offset += batch.transactions.length;
        hasMore = batch.hasMore && batch.transactions.length > 0;
      } catch (error) {
        this.loggerService.error({ event: "TRANSACTION_FETCH_ERROR", error, userId, offset });
        yield this.createEmptyCsvRow(this.sanitizeForCsv("Error retrieving some transactions. Please contact support."));
        hasMore = false;
      }
    }

    if (!hasYieldedAny) {
      yield this.createEmptyCsvRow("No transactions found for the specified date range");
    }
  }

  private createEmptyCsvRow(id: string): TransactionCsvRow {
    return {
      id,
      date: "",
      type: "",
      amount: "",
      bonusAmount: "",
      amountRefunded: "",
      currency: "",
      status: "",
      cardBrand: "",
      cardLast4: "",
      description: "",
      invoiceId: "",
      receiptUrl: ""
    };
  }

  private sanitizeForCsv(value: string): string {
    if (!value) return "";

    if (/^[=+\-@]/.test(value)) {
      return "'" + value;
    }

    return value;
  }

  private transformTransactionForCsv(transaction: Transaction, timeZone: string): TransactionCsvRow {
    const amount = (transaction.amount / 100).toFixed(2);
    const date = new Date(transaction.created * 1000).toLocaleString("en-CA", {
      timeZone
    });

    return {
      id: transaction.id,
      date,
      type: transaction.type,
      amount,
      bonusAmount: ((transaction.bonusAmount ?? 0) / 100).toFixed(2),
      amountRefunded: ((transaction.amountRefunded ?? 0) / 100).toFixed(2),
      currency: transaction.currency.toUpperCase(),
      status: transaction.status,
      cardBrand: transaction.cardBrand || "",
      cardLast4: transaction.cardLast4 || "",
      description: this.sanitizeForCsv(transaction.description || ""),
      invoiceId: transaction.stripeInvoiceId || "",
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
