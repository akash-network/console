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

    it("returns payment transactions key with offset", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ offset: 10 })).toEqual(["STRIPE_TRANSACTIONS", "offset", "10"]);
      expect(QueryKeys.getPaymentTransactionsKey({ offset: 20 })).toEqual(["STRIPE_TRANSACTIONS", "offset", "20"]);
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

    it("returns payment transactions key with multiple options", () => {
      const startDate = new Date(1234567890);
      const endDate = new Date(1234567900);
      expect(
        QueryKeys.getPaymentTransactionsKey({
          limit: 25,
          offset: 50,
          startDate,
          endDate
        })
      ).toEqual(["STRIPE_TRANSACTIONS", "limit", "25", "offset", "50", "start_date", startDate.toISOString(), "end_date", endDate.toISOString()]);
    });

    it("omits offset when it is null or zero", () => {
      expect(QueryKeys.getPaymentTransactionsKey({ offset: null })).toEqual(["STRIPE_TRANSACTIONS"]);
      expect(QueryKeys.getPaymentTransactionsKey({ offset: 0 })).toEqual(["STRIPE_TRANSACTIONS"]);
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
