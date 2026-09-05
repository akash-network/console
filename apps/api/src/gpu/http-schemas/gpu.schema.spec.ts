import { describe, expect, it } from "vitest";

import { GpuBreakdownQuerySchema } from "./gpu.schema";

describe("GpuBreakdownQuerySchema", () => {
  it("derives startDate as 30 days before the provided endDate", () => {
    const result = GpuBreakdownQuerySchema.parse({ endDate: "2024-01-31" });

    expect(result.startDate).toBe("2024-01-01");
    expect(result.endDate).toBe("2024-01-31");
  });

  it("computes startDate in UTC regardless of the process timezone", () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";

    try {
      const result = GpuBreakdownQuerySchema.parse({ endDate: "2024-11-15" });

      expect(result.startDate).toBe("2024-10-16");
    } finally {
      process.env.TZ = originalTimezone;
    }
  });

  it("keeps the provided dates and filters untouched", () => {
    const result = GpuBreakdownQuerySchema.parse({ startDate: "2024-01-01", endDate: "2024-01-31", vendor: "nvidia", model: "h100" });

    expect(result).toEqual({ startDate: "2024-01-01", endDate: "2024-01-31", vendor: "nvidia", model: "h100" });
  });

  it("defaults endDate to today and spans a 30-day window when both dates are omitted", () => {
    const result = GpuBreakdownQuerySchema.parse({});

    expect(result.endDate).toBe(new Date().toISOString().split("T")[0]);
    const spanInDays = (Date.parse(result.endDate) - Date.parse(result.startDate)) / (24 * 60 * 60 * 1000);
    expect(spanInDays).toBe(30);
  });

  it("accepts a single-day range", () => {
    const result = GpuBreakdownQuerySchema.parse({ startDate: "2024-01-31", endDate: "2024-01-31" });

    expect(result.startDate).toBe("2024-01-31");
  });

  it("rejects a range wider than 366 days", () => {
    expect(() => GpuBreakdownQuerySchema.parse({ startDate: "2023-01-01", endDate: "2024-12-31" })).toThrow(
      "Date range cannot exceed 366 days and startDate must be before endDate"
    );
  });

  it("rejects a startDate after the endDate", () => {
    expect(() => GpuBreakdownQuerySchema.parse({ startDate: "2024-02-01", endDate: "2024-01-01" })).toThrow(
      "Date range cannot exceed 366 days and startDate must be before endDate"
    );
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(() => GpuBreakdownQuerySchema.parse({ startDate: "01/01/2024" })).toThrow();
  });
});
