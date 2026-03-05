import { describe, expect, it } from "vitest";

import { QueryKeys } from "./queryKeys";

describe("QueryKeys", () => {
  describe("Payment transactions query key", () => {
    it("should return basic payment transactions key with no options", () => {
      expect(QueryKeys.getPaymentTransactionsKey()).toEqual(["STRIPE_TRANSACTIONS"]);
    });

    it("should return payment transactions key with limit", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ limit: 10 })).toEqual(["STRIPE_TRANSACTIONS", "limit", "10"]);
      expect(QueryKeys.getPaymentTransactionsKey({ limit: 50 })).toEqual(["STRIPE_TRANSACTIONS", "limit", "50"]);
    });

    it("should return payment transactions key with startingAfter", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ startingAfter: "txn_123" })).toEqual(["STRIPE_TRANSACTIONS", "after", "txn_123"]);
      expect(QueryKeys.getPaymentTransactionsKey({ startingAfter: "txn_456" })).toEqual(["STRIPE_TRANSACTIONS", "after", "txn_456"]);
    });

    it("should return payment transactions key with endingBefore", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ endingBefore: "txn_123" })).toEqual(["STRIPE_TRANSACTIONS", "before", "txn_123"]);
      expect(QueryKeys.getPaymentTransactionsKey({ endingBefore: "txn_456" })).toEqual(["STRIPE_TRANSACTIONS", "before", "txn_456"]);
    });

    it("should return payment transactions key with created start_date", () => {
      const startDate = new Date();
      expect(QueryKeys.getPaymentTransactionsKey({ startDate })).toEqual(["STRIPE_TRANSACTIONS", "start_date", startDate.toISOString()]);
    });

    it("should return payment transactions key with created end_date", () => {
      const endDate = new Date();
      expect(QueryKeys.getPaymentTransactionsKey({ endDate })).toEqual(["STRIPE_TRANSACTIONS", "end_date", endDate.toISOString()]);
    });

    it("should return payment transactions key with created start_date and end_date", () => {
      const startDate = new Date(1234567890);
      const endDate = new Date(1234567900);
      expect(QueryKeys.getPaymentTransactionsKey({ startDate, endDate })).toEqual([
        "STRIPE_TRANSACTIONS",
        "start_date",
        startDate.toISOString(),
        "end_date",
        endDate.toISOString()
      ]);
    });

    it("should return payment transactions key with multiple options", () => {
      const startDate = new Date(1234567890);
      const endDate = new Date(1234567900);
      expect(
        QueryKeys.getPaymentTransactionsKey({
          limit: 25,
          startingAfter: "txn_123",
          endingBefore: "txn_456",
          startDate,
          endDate
        })
      ).toEqual([
        "STRIPE_TRANSACTIONS",
        "limit",
        "25",
        "after",
        "txn_123",
        "before",
        "txn_456",
        "start_date",
        startDate.toISOString(),
        "end_date",
        endDate.toISOString()
      ]);
    });

    it("should handle null values for startingAfter and endingBefore", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ startingAfter: null })).toEqual(["STRIPE_TRANSACTIONS"]);
      expect(QueryKeys.getPaymentTransactionsKey({ endingBefore: null })).toEqual(["STRIPE_TRANSACTIONS"]);
    });

    it("should handle partial created options", () => {
      expect(QueryKeys.getPaymentTransactionsKey()).toEqual(["STRIPE_TRANSACTIONS"]);
      const startDate = new Date(1234567890);
      expect(QueryKeys.getPaymentTransactionsKey({ startDate })).toEqual(["STRIPE_TRANSACTIONS", "start_date", startDate.toISOString()]);
      const endDate = new Date(1234567900);
      expect(QueryKeys.getPaymentTransactionsKey({ endDate })).toEqual(["STRIPE_TRANSACTIONS", "end_date", endDate.toISOString()]);
    });
  });

  describe("Export transactions CSV query key", () => {
    it("should return basic export transactions CSV key with timezone", () => {
      expect(QueryKeys.getExportTransactionsCsvKey({ timezone: "UTC" })).toEqual(["EXPORT_TRANSACTIONS_CSV", "UTC"]);
      expect(QueryKeys.getExportTransactionsCsvKey({ timezone: "America/New_York" })).toEqual(["EXPORT_TRANSACTIONS_CSV", "America/New_York"]);
    });

    it("should return export transactions CSV key with startDate", () => {
      const startDate = new Date();
      expect(QueryKeys.getExportTransactionsCsvKey({ startDate, timezone: "UTC" })).toEqual([
        "EXPORT_TRANSACTIONS_CSV",
        "UTC",
        "start_date",
        startDate.toISOString()
      ]);
    });

    it("should return export transactions CSV key with endDate", () => {
      const endDate = new Date();
      expect(QueryKeys.getExportTransactionsCsvKey({ endDate, timezone: "UTC" })).toEqual([
        "EXPORT_TRANSACTIONS_CSV",
        "UTC",
        "end_date",
        endDate.toISOString()
      ]);
    });

    it("should return export transactions CSV key with both startDate and endDate", () => {
      const startDate = new Date(1234567890);
      const endDate = new Date(1234567900);
      expect(QueryKeys.getExportTransactionsCsvKey({ startDate, endDate, timezone: "UTC" })).toEqual([
        "EXPORT_TRANSACTIONS_CSV",
        "UTC",
        "start_date",
        startDate.toISOString(),
        "end_date",
        endDate.toISOString()
      ]);
    });

    it("should handle null values for startDate and endDate", () => {
      expect(QueryKeys.getExportTransactionsCsvKey({ startDate: null, endDate: null, timezone: "UTC" })).toEqual(["EXPORT_TRANSACTIONS_CSV", "UTC"]);
    });
  });
});
