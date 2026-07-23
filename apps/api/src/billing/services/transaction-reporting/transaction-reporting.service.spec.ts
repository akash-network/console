import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import { TransactionReportingService } from "./transaction-reporting.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createTestTransaction } from "@test/seeders/stripe-transaction-test.seeder";

const USER_ID = "user-123";

describe(TransactionReportingService.name, () => {
  describe("getCustomerTransactions", () => {
    it("maps stored transactions of every type to the response DTO", async () => {
      const { service, stripeTransactionRepository } = setup();
      const payment = generateDatabaseStripeTransaction({ type: "payment_intent", amount: 5000, cardBrand: "visa", cardLast4: "4242" });
      const coupon = generateDatabaseStripeTransaction({ type: "coupon_claim", amount: 1000, stripeInvoiceId: "in_1" });
      const manual = generateDatabaseStripeTransaction({ type: "manual_credit", amount: 2000, stripeInvoiceId: "in_2" });
      stripeTransactionRepository.findByUserId.mockResolvedValue([payment, coupon, manual]);
      stripeTransactionRepository.countByUserId.mockResolvedValue(3);

      const result = await service.getCustomerTransactions(USER_ID);

      expect(stripeTransactionRepository.findByUserId).toHaveBeenCalledWith({
        userId: USER_ID,
        startDate: undefined,
        endDate: undefined,
        limit: 100,
        offset: 0
      });
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(false);
      expect(result.transactions.map(transaction => transaction.type)).toEqual(["payment_intent", "coupon_claim", "manual_credit"]);
    });

    it("maps a stored row to the flat DTO shape", async () => {
      const { service, stripeTransactionRepository } = setup();
      const row = generateDatabaseStripeTransaction({
        id: "txn-1",
        type: "payment_intent",
        status: "succeeded",
        amount: 5000,
        amountRefunded: 0,
        bonusAmount: 250,
        currency: "usd",
        cardBrand: "visa",
        cardLast4: "4242",
        stripeInvoiceId: null,
        receiptUrl: "https://receipt",
        description: "Wallet top-up",
        createdAt: new Date("2024-01-02T03:04:05Z")
      });
      stripeTransactionRepository.findByUserId.mockResolvedValue([row]);
      stripeTransactionRepository.countByUserId.mockResolvedValue(1);

      const result = await service.getCustomerTransactions(USER_ID);

      expect(result.transactions[0]).toEqual({
        id: "txn-1",
        type: "payment_intent",
        amount: 5000,
        amountRefunded: 0,
        bonusAmount: 250,
        currency: "usd",
        status: "succeeded",
        created: Math.floor(new Date("2024-01-02T03:04:05Z").getTime() / 1000),
        cardBrand: "visa",
        cardLast4: "4242",
        stripeInvoiceId: null,
        receiptUrl: "https://receipt",
        description: "Wallet top-up"
      });
    });

    it("surfaces refunded status and the refunded amount", async () => {
      const { service, stripeTransactionRepository } = setup();
      const refunded = generateDatabaseStripeTransaction({ type: "payment_intent", status: "refunded", amount: 5000, amountRefunded: 2000 });
      stripeTransactionRepository.findByUserId.mockResolvedValue([refunded]);
      stripeTransactionRepository.countByUserId.mockResolvedValue(1);

      const result = await service.getCustomerTransactions(USER_ID);

      expect(result.transactions[0].status).toBe("refunded");
      expect(result.transactions[0].amountRefunded).toBe(2000);
    });

    it("passes offset and date filters through to the repository and count", async () => {
      const { service, stripeTransactionRepository } = setup();
      stripeTransactionRepository.findByUserId.mockResolvedValue([]);
      stripeTransactionRepository.countByUserId.mockResolvedValue(0);
      const startDate = "2022-01-01T00:00:00.000Z";
      const endDate = "2022-12-31T23:59:59.000Z";

      await service.getCustomerTransactions(USER_ID, { limit: 25, offset: 50, startDate, endDate });

      expect(stripeTransactionRepository.findByUserId).toHaveBeenCalledWith({
        userId: USER_ID,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        limit: 25,
        offset: 50
      });
      expect(stripeTransactionRepository.countByUserId).toHaveBeenCalledWith(USER_ID, {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });
    });

    it("reports hasMore when the page does not reach the total count", async () => {
      const { service, stripeTransactionRepository } = setup();
      stripeTransactionRepository.findByUserId.mockResolvedValue([generateDatabaseStripeTransaction(), generateDatabaseStripeTransaction()]);
      stripeTransactionRepository.countByUserId.mockResolvedValue(10);

      const result = await service.getCustomerTransactions(USER_ID, { limit: 2, offset: 0 });

      expect(result.hasMore).toBe(true);
    });

    it("reports no more results on the last page", async () => {
      const { service, stripeTransactionRepository } = setup();
      stripeTransactionRepository.findByUserId.mockResolvedValue([generateDatabaseStripeTransaction(), generateDatabaseStripeTransaction()]);
      stripeTransactionRepository.countByUserId.mockResolvedValue(10);

      const result = await service.getCustomerTransactions(USER_ID, { limit: 2, offset: 8 });

      expect(result.hasMore).toBe(false);
    });
  });

  describe("exportTransactionsCsvStream", () => {
    const CSV_HEADER =
      "Transaction ID,Date (America/New_York),Type,Amount,Bonus,Refunded,Currency,Status,Card Brand,Card Last 4,Description,Invoice ID,Receipt URL";

    it("streams transactions for a single page", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction();

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        totalCount: 1,
        hasMore: false
      });

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain(CSV_HEADER);
      expect(fullCsv).toContain(mockTransaction.id);
      expect(fullCsv).toContain("2021-12-31, 7:00:00 p.m.");
      expect(fullCsv).toContain("payment_intent");
      expect(fullCsv).toContain("10.00");
      expect(fullCsv).toContain("visa");
      expect(fullCsv).toContain("4242");
    });

    it("writes the recorded bonus next to the amount", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction({ amount: 15000, bonusAmount: 1500 });

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        totalCount: 1,
        hasMore: false
      });

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      expect(chunks.join("")).toContain("150.00,15.00");
    });

    it("writes the refunded amount and invoice id columns", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction({ type: "coupon_claim", amount: 5000, amountRefunded: 2000, stripeInvoiceId: "in_export" });

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        totalCount: 1,
        hasMore: false
      });

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");
      expect(fullCsv).toContain("coupon_claim");
      expect(fullCsv).toContain("20.00");
      expect(fullCsv).toContain("in_export");
    });

    it("streams multiple pages without loading all into memory", async () => {
      const { service } = setup();

      const firstPageTransaction = createTestTransaction({ id: "ch_001", amount: 1000, description: "First transaction" });
      const secondPageTransaction = createTestTransaction({ id: "ch_002", amount: 2000, created: 1641081600, description: "Second transaction" });

      vi.spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: [firstPageTransaction],
          totalCount: 2,
          hasMore: true
        })
        .mockResolvedValueOnce({
          transactions: [secondPageTransaction],
          totalCount: 2,
          hasMore: false
        });

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(service.getCustomerTransactions).toHaveBeenCalledTimes(2);
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(1, USER_ID, {
        limit: 100,
        offset: 0,
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z"
      });
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(2, USER_ID, {
        limit: 100,
        offset: 1,
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z"
      });

      expect(fullCsv).toContain("ch_001");
      expect(fullCsv).toContain("ch_002");
      expect(fullCsv).toContain("First transaction");
      expect(fullCsv).toContain("Second transaction");
    });

    it("returns message when no transactions found", async () => {
      const { service } = setup();

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [],
        totalCount: 0,
        hasMore: false
      });

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");
      expect(fullCsv).toContain("No transactions found for the specified date range");
    });

    it("handles transactions with null card details", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction({
        id: "ch_123",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        created: 1640995200,
        cardBrand: null,
        cardLast4: null,
        receiptUrl: null,
        description: "No card details"
      });

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        totalCount: 1,
        hasMore: false
      });

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain("ch_123");
      expect(fullCsv).toContain("No card details");
      expect(fullCsv).toContain(",,No card details,");
    });

    it("yields a generic sanitized placeholder without leaking the raw error message", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction();

      vi.spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: [mockTransaction],
          totalCount: 5,
          hasMore: true
        })
        .mockRejectedValueOnce(new Error("Stripe API error"));

      const csvStream = service.exportTransactionsCsvStream(USER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain(CSV_HEADER);
      expect(fullCsv).toContain("ch_123");
      expect(fullCsv).toContain("Error retrieving some transactions. Please contact support.");
      expect(fullCsv).not.toContain("Stripe API error");
    });
  });

  function setup() {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    const service = new TransactionReportingService(stripeTransactionRepository, () => mock<LoggerService>());
    return { service, stripeTransactionRepository };
  }
});
