import { describe, expect, it } from "vitest";

import { QueryKeys } from "./queryKeys";

describe("QueryKeys", () => {
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
