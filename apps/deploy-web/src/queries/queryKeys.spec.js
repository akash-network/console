"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var queryKeys_1 = require("./queryKeys");
describe("QueryKeys", function () {
    describe("Payment transactions query key", function () {
        it("should return basic payment transactions key with no options", function () {
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey()).toEqual(["STRIPE_TRANSACTIONS"]);
        });
        it("should return payment transactions key with limit", function () {
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ limit: 10 })).toEqual(["STRIPE_TRANSACTIONS", "limit", "10"]);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ limit: 50 })).toEqual(["STRIPE_TRANSACTIONS", "limit", "50"]);
        });
        it("should return payment transactions key with startingAfter", function () {
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ startingAfter: "txn_123" })).toEqual(["STRIPE_TRANSACTIONS", "after", "txn_123"]);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ startingAfter: "txn_456" })).toEqual(["STRIPE_TRANSACTIONS", "after", "txn_456"]);
        });
        it("should return payment transactions key with endingBefore", function () {
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ endingBefore: "txn_123" })).toEqual(["STRIPE_TRANSACTIONS", "before", "txn_123"]);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ endingBefore: "txn_456" })).toEqual(["STRIPE_TRANSACTIONS", "before", "txn_456"]);
        });
        it("should return payment transactions key with created start_date", function () {
            var startDate = new Date();
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ startDate: startDate })).toEqual(["STRIPE_TRANSACTIONS", "start_date", startDate.toISOString()]);
        });
        it("should return payment transactions key with created end_date", function () {
            var endDate = new Date();
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ endDate: endDate })).toEqual(["STRIPE_TRANSACTIONS", "end_date", endDate.toISOString()]);
        });
        it("should return payment transactions key with created start_date and end_date", function () {
            var startDate = new Date(1234567890);
            var endDate = new Date(1234567900);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ startDate: startDate, endDate: endDate })).toEqual([
                "STRIPE_TRANSACTIONS",
                "start_date",
                startDate.toISOString(),
                "end_date",
                endDate.toISOString()
            ]);
        });
        it("should return payment transactions key with multiple options", function () {
            var startDate = new Date(1234567890);
            var endDate = new Date(1234567900);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({
                limit: 25,
                startingAfter: "txn_123",
                endingBefore: "txn_456",
                startDate: startDate,
                endDate: endDate
            })).toEqual([
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
        it("should handle null values for startingAfter and endingBefore", function () {
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ startingAfter: null })).toEqual(["STRIPE_TRANSACTIONS"]);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ endingBefore: null })).toEqual(["STRIPE_TRANSACTIONS"]);
        });
        it("should handle partial created options", function () {
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey()).toEqual(["STRIPE_TRANSACTIONS"]);
            var startDate = new Date(1234567890);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ startDate: startDate })).toEqual(["STRIPE_TRANSACTIONS", "start_date", startDate.toISOString()]);
            var endDate = new Date(1234567900);
            expect(queryKeys_1.QueryKeys.getPaymentTransactionsKey({ endDate: endDate })).toEqual(["STRIPE_TRANSACTIONS", "end_date", endDate.toISOString()]);
        });
    });
    describe("Export transactions CSV query key", function () {
        it("should return basic export transactions CSV key with timezone", function () {
            expect(queryKeys_1.QueryKeys.getExportTransactionsCsvKey({ timezone: "UTC" })).toEqual(["EXPORT_TRANSACTIONS_CSV", "UTC"]);
            expect(queryKeys_1.QueryKeys.getExportTransactionsCsvKey({ timezone: "America/New_York" })).toEqual(["EXPORT_TRANSACTIONS_CSV", "America/New_York"]);
        });
        it("should return export transactions CSV key with startDate", function () {
            var startDate = new Date();
            expect(queryKeys_1.QueryKeys.getExportTransactionsCsvKey({ startDate: startDate, timezone: "UTC" })).toEqual([
                "EXPORT_TRANSACTIONS_CSV",
                "UTC",
                "start_date",
                startDate.toISOString()
            ]);
        });
        it("should return export transactions CSV key with endDate", function () {
            var endDate = new Date();
            expect(queryKeys_1.QueryKeys.getExportTransactionsCsvKey({ endDate: endDate, timezone: "UTC" })).toEqual([
                "EXPORT_TRANSACTIONS_CSV",
                "UTC",
                "end_date",
                endDate.toISOString()
            ]);
        });
        it("should return export transactions CSV key with both startDate and endDate", function () {
            var startDate = new Date(1234567890);
            var endDate = new Date(1234567900);
            expect(queryKeys_1.QueryKeys.getExportTransactionsCsvKey({ startDate: startDate, endDate: endDate, timezone: "UTC" })).toEqual([
                "EXPORT_TRANSACTIONS_CSV",
                "UTC",
                "start_date",
                startDate.toISOString(),
                "end_date",
                endDate.toISOString()
            ]);
        });
        it("should handle null values for startDate and endDate", function () {
            expect(queryKeys_1.QueryKeys.getExportTransactionsCsvKey({ startDate: null, endDate: null, timezone: "UTC" })).toEqual(["EXPORT_TRANSACTIONS_CSV", "UTC"]);
        });
    });
});
