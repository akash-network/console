import { describe, expect, it } from "vitest";

import { GetUsageHistoryQuerySchema } from "./usage.schema";

describe("Usage Schema", () => {
  describe("GetUsageHistoryQuerySchema", () => {
    const address = "akash18andxgtd6r08zzfpcdqg9pdr6smks7gv76tyt6";

    it("derives startDate as 30 days before the provided endDate", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, endDate: "2024-01-31" });

      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-01-31");
    });

    it("derives startDate across month and year boundaries", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, endDate: "2024-01-15" });

      expect(result.startDate).toBe("2023-12-16");
      expect(result.endDate).toBe("2024-01-15");
    });

    it("computes startDate in UTC regardless of the process timezone", () => {
      const originalTimezone = process.env.TZ;
      process.env.TZ = "America/New_York";

      try {
        const result = GetUsageHistoryQuerySchema.parse({ address, endDate: "2024-11-15" });

        expect(result.startDate).toBe("2024-10-16");
        expect(result.endDate).toBe("2024-11-15");
      } finally {
        process.env.TZ = originalTimezone;
      }
    });

    it("keeps the provided startDate untouched", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-01-01", endDate: "2024-01-31" });

      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-01-31");
    });

    it("defaults endDate to today and spans a 30-day window when both dates are omitted", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address });

      expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const spanInDays = (Date.parse(result.endDate) - Date.parse(result.startDate)) / (24 * 60 * 60 * 1000);
      expect(spanInDays).toBe(30);
    });

    it("rejects a range wider than 366 days", () => {
      expect(() => GetUsageHistoryQuerySchema.parse({ address, startDate: "2023-01-01", endDate: "2024-12-31" })).toThrow(
        "Date range cannot exceed 366 days and startDate must be before endDate"
      );
    });

    it("rejects a startDate after the endDate", () => {
      expect(() => GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-02-01", endDate: "2024-01-01" })).toThrow(
        "Date range cannot exceed 366 days and startDate must be before endDate"
      );
    });
  });
});
