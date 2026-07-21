import type { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import { TransactionReportingService } from "./transaction-reporting.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { generatePaymentMethod } from "@test/seeders/payment-method.seeder";
import { createTestCharge, TEST_CONSTANTS } from "@test/seeders/stripe-test-data.seeder";
import { createTestTransaction } from "@test/seeders/stripe-transaction-test.seeder";

describe(TransactionReportingService.name, () => {
  describe("getCustomerTransactions", () => {
    it("returns formatted transactions", async () => {
      const { service, stripe } = setup();
      const mockCharge = createTestCharge();
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);
      expect(result).toEqual({
        transactions: [
          {
            id: mockCharge.id,
            amount: mockCharge.amount,
            bonusAmount: 0,
            currency: mockCharge.currency,
            status: mockCharge.status,
            created: mockCharge.created,
            paymentMethod: mockCharge.payment_method_details,
            receiptUrl: mockCharge.receipt_url,
            description: mockCharge.description,
            metadata: mockCharge.metadata
          }
        ],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });
    });

    it("attaches the recorded first-purchase bonus to matching charges", async () => {
      const { service, stripe, stripeTransactionRepository } = setup();
      const bonusCharge = createTestCharge({ id: "ch_bonus" });
      const plainCharge = createTestCharge({ id: "ch_plain" });
      const mockCharges = {
        data: [bonusCharge, plainCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);
      stripeTransactionRepository.findByChargeIds.mockResolvedValue([generateDatabaseStripeTransaction({ stripeChargeId: "ch_bonus", bonusAmount: 1000 })]);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);

      expect(stripeTransactionRepository.findByChargeIds).toHaveBeenCalledWith(["ch_bonus", "ch_plain"]);
      expect(result.transactions[0].bonusAmount).toBe(1000);
      expect(result.transactions[1].bonusAmount).toBe(0);
    });

    it("sanitizes link email from payment method details", async () => {
      const { service, stripe } = setup();
      const mockCharge = createTestCharge({
        id: "ch_link",
        payment_method_details: { type: "link", link: { email: "user@test.com" } } as unknown as Stripe.Charge.PaymentMethodDetails
      });
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);
      expect(result.transactions[0].paymentMethod).toEqual({
        type: "link",
        link: { email: undefined }
      });
    });

    it("returns null paymentMethod when payment_method_details is null", async () => {
      const { service, stripe } = setup();
      const mockCharge = createTestCharge({
        id: "ch_null_pm",
        payment_method_details: null as unknown as Stripe.Charge.PaymentMethodDetails
      });
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);
      expect(result.transactions[0].paymentMethod).toBeNull();
    });

    it("calls charges.list with endingBefore parameter", async () => {
      const { service, stripe } = setup();
      const mockCharge = createTestCharge({ id: "ch_456", amount: 2000 });
      const mockCharges = {
        data: [mockCharge],
        has_more: true
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, {
        endingBefore: "ch_before_id",
        limit: 50
      });

      expect(stripe.charges.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        limit: 50,
        created: undefined,
        starting_after: undefined,
        ending_before: "ch_before_id",
        expand: ["data.payment_intent"]
      });
    });

    it("calls charges.list with created parameter", async () => {
      const { service, stripe } = setup();
      const mockCharge = createTestCharge({ id: "ch_789", amount: 3000 });
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const startDate = new Date("2022-01-01T00:00:00Z").toISOString();
      const endDate = new Date("2022-12-31T23:59:59Z").toISOString();
      await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate,
        endDate,
        limit: 25
      });

      expect(stripe.charges.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        limit: 25,
        created: {
          gte: new Date(startDate).getTime() / 1000,
          lte: new Date(endDate).getTime() / 1000
        },
        starting_after: undefined,
        ending_before: undefined,
        expand: ["data.payment_intent"]
      });
    });

    it("returns correct prevPage when startingAfter is provided", async () => {
      const { service, stripe } = setup();
      const firstCharge = createTestCharge({
        id: "ch_first",
        amount: 1000,
        description: "First charge"
      });
      const secondCharge = createTestCharge({
        id: "ch_second",
        amount: 2000,
        created: 1234567891,
        description: "Second charge"
      });
      const mockCharges = {
        data: [firstCharge, secondCharge],
        has_more: true
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, {
        startingAfter: "ch_previous_id"
      });

      expect(result).toEqual({
        transactions: [
          {
            id: firstCharge.id,
            amount: firstCharge.amount,
            bonusAmount: 0,
            currency: firstCharge.currency,
            status: firstCharge.status,
            created: firstCharge.created,
            paymentMethod: firstCharge.payment_method_details,
            receiptUrl: firstCharge.receipt_url,
            description: firstCharge.description,
            metadata: firstCharge.metadata
          },
          {
            id: secondCharge.id,
            amount: secondCharge.amount,
            bonusAmount: 0,
            currency: secondCharge.currency,
            status: secondCharge.status,
            created: secondCharge.created,
            paymentMethod: secondCharge.payment_method_details,
            receiptUrl: secondCharge.receipt_url,
            description: secondCharge.description,
            metadata: secondCharge.metadata
          }
        ],
        hasMore: true,
        nextPage: secondCharge.id,
        prevPage: firstCharge.id
      });
    });

    it("returns null prevPage when startingAfter is not provided", async () => {
      const { service, stripe } = setup();
      const mockCharge = createTestCharge({
        id: "ch_only",
        description: "Only charge"
      });
      const mockCharges = {
        data: [mockCharge],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const result = await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID);

      expect(result.prevPage).toBeNull();
    });

    it("calls charges.list with all parameters combined", async () => {
      const { service, stripe } = setup();
      const mockCharges = {
        data: [],
        has_more: false
      } as unknown as Stripe.Response<Stripe.ApiList<Stripe.Charge>>;

      vi.spyOn(stripe.charges, "list").mockResolvedValue(mockCharges);

      const startDate = new Date("2021-01-01T00:00:00Z").toISOString();
      const endDate = new Date("2021-12-31T23:59:59Z").toISOString();

      const options = {
        limit: 10,
        startingAfter: "ch_start_id",
        endingBefore: "ch_end_id",
        startDate,
        endDate
      };

      await service.getCustomerTransactions(TEST_CONSTANTS.CUSTOMER_ID, options);

      expect(stripe.charges.list).toHaveBeenCalledWith({
        customer: TEST_CONSTANTS.CUSTOMER_ID,
        limit: 10,
        created: {
          gte: new Date(startDate).getTime() / 1000,
          lte: new Date(endDate).getTime() / 1000
        },
        starting_after: "ch_start_id",
        ending_before: "ch_end_id",
        expand: ["data.payment_intent"]
      });
    });
  });

  describe("exportTransactionsCsvStream", () => {
    it("streams transactions for a single page", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction();

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain(
        "Transaction ID,Date (America/New_York),Amount,Bonus,Currency,Status,Payment Method,Card Brand,Card Last 4,Description,Receipt URL"
      );

      expect(fullCsv).toContain(mockTransaction.id);
      expect(fullCsv).toContain("2021-12-31, 7:00:00 p.m.");
      expect(fullCsv).toContain("10.00");
      expect(fullCsv).toContain("visa");
      expect(fullCsv).toContain("4242");
    });

    it("writes the recorded bonus next to the amount", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction({ amount: 15000, bonusAmount: 1500 });

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
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

    it("streams multiple pages without loading all into memory", async () => {
      const { service } = setup();

      const firstPageTransaction = createTestTransaction({
        id: "ch_001",
        amount: 1000,
        description: "First transaction",
        paymentMethod: generatePaymentMethod({
          type: "card",
          card: {
            brand: "visa",
            last4: "1111"
          }
        })
      });

      const secondPageTransaction = createTestTransaction({
        id: "ch_002",
        amount: 2000,
        created: 1641081600,
        description: "Second transaction",
        paymentMethod: generatePaymentMethod({
          type: "card",
          card: {
            brand: "mastercard",
            last4: "2222"
          }
        })
      });

      vi.spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: [firstPageTransaction],
          hasMore: true,
          nextPage: "ch_001",
          prevPage: null
        })
        .mockResolvedValueOnce({
          transactions: [secondPageTransaction],
          hasMore: false,
          nextPage: null,
          prevPage: "ch_002"
        });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
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
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(1, TEST_CONSTANTS.CUSTOMER_ID, {
        limit: 100,
        startingAfter: undefined,
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z"
      });
      expect(service.getCustomerTransactions).toHaveBeenNthCalledWith(2, TEST_CONSTANTS.CUSTOMER_ID, {
        limit: 100,
        startingAfter: "ch_001",
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
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
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

    it("handles transactions with null payment methods", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction({
        id: "ch_123",
        amount: 1000,
        currency: "usd",
        status: "succeeded",
        created: 1640995200,
        paymentMethod: null,
        receiptUrl: null,
        description: "No payment method"
      });

      vi.spyOn(service, "getCustomerTransactions").mockResolvedValue({
        transactions: [mockTransaction],
        hasMore: false,
        nextPage: null,
        prevPage: null
      });

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
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
      expect(fullCsv).toContain("No payment method");
      expect(fullCsv).toMatch(/ch_123,"[^"]*",[^,]*,[^,]*,[^,]*,[^,]*,,,,No payment method,/);
    });

    it("handles error during streaming gracefully", async () => {
      const { service } = setup();
      const mockTransaction = createTestTransaction();

      vi.spyOn(service, "getCustomerTransactions")
        .mockResolvedValueOnce({
          transactions: [mockTransaction],
          hasMore: true,
          nextPage: "ch_123",
          prevPage: null
        })
        .mockRejectedValueOnce(new Error("Stripe API error"));

      const csvStream = service.exportTransactionsCsvStream(TEST_CONSTANTS.CUSTOMER_ID, {
        startDate: "2022-01-01T00:00:00Z",
        endDate: "2022-01-31T23:59:59Z",
        timezone: "America/New_York"
      });

      const chunks: string[] = [];
      for await (const chunk of csvStream) {
        chunks.push(chunk);
      }

      const fullCsv = chunks.join("");

      expect(fullCsv).toContain(
        "Transaction ID,Date (America/New_York),Amount,Bonus,Currency,Status,Payment Method,Card Brand,Card Last 4,Description,Receipt URL"
      );
      expect(fullCsv).toContain("ch_123");
      expect(fullCsv).toContain("Error: unable to fetch transactions");
      expect(fullCsv).not.toContain("Stripe API error");
    });
  });

  function setup() {
    const stripe = new Stripe(`sk_test_${faker.string.alphanumeric(32)}`, { apiVersion: "2025-10-29.clover", httpClient: Stripe.createFetchHttpClient() });
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.findByChargeIds.mockResolvedValue([]);
    const service = new TransactionReportingService(stripe, stripeTransactionRepository, () => mock<LoggerService>());
    return { service, stripe, stripeTransactionRepository };
  }
});
