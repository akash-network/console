import { describe, expect, it, vi } from "vitest";

import { GetUsageHistoryQuerySchema } from "./usage.schema";

describe("Usage Schema", () => {
  describe("GetUsageHistoryQuerySchema", () => {
    const address = "akash18andxgtd6r08zzfpcdqg9pdr6smks7gv76tyt6";

    it("defaults startDate so the window covers the 30 days ending at endDate", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, endDate: "2024-01-31" });

      expect(result.startDate).toBe("2024-01-02");
      expect(result.endDate).toBe("2024-01-31");
    });

    it("derives startDate across month and year boundaries", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, endDate: "2024-01-15" });

      expect(result.startDate).toBe("2023-12-17");
      expect(result.endDate).toBe("2024-01-15");
    });

    it("computes startDate in UTC regardless of the process timezone", () => {
      vi.stubEnv("TZ", "America/New_York");

      try {
        const result = GetUsageHistoryQuerySchema.parse({ address, endDate: "2024-11-15" });

        expect(result.startDate).toBe("2024-10-17");
        expect(result.endDate).toBe("2024-11-15");
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("keeps the provided startDate untouched", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-01-01", endDate: "2024-01-31" });

      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-01-31");
    });

    it("defaults endDate to today and covers 30 days when both dates are omitted", () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2024-11-15T23:59:59.999Z"));

      try {
        const result = GetUsageHistoryQuerySchema.parse({ address });

        expect(result.endDate).toBe("2024-11-15");
        expect(result.startDate).toBe("2024-10-17");
      } finally {
        vi.useRealTimers();
      }
    });

    it("accepts a single-day range", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-01-31", endDate: "2024-01-31" });

      expect(result.startDate).toBe("2024-01-31");
      expect(result.endDate).toBe("2024-01-31");
    });

    it("accepts a range of exactly 366 days", () => {
      const result = GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-01-01", endDate: "2024-12-31" });

      expect(result.startDate).toBe("2024-01-01");
      expect(result.endDate).toBe("2024-12-31");
    });

    it("rejects a range wider than 366 days", () => {
      expect(() => GetUsageHistoryQuerySchema.parse({ address, startDate: "2023-01-01", endDate: "2024-12-31" })).toThrow(
        "Date range cannot exceed 366 days and startDate must not be after endDate"
      );
    });

    it("rejects a range of 367 days", () => {
      expect(() => GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-01-01", endDate: "2025-01-01" })).toThrow(
        "Date range cannot exceed 366 days and startDate must not be after endDate"
      );
    });

    it("rejects a startDate after the endDate", () => {
      expect(() => GetUsageHistoryQuerySchema.parse({ address, startDate: "2024-02-01", endDate: "2024-01-01" })).toThrow(
        "Date range cannot exceed 366 days and startDate must not be after endDate"
      );
    });
  });
});
