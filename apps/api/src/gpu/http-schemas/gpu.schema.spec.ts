import { describe, expect, it, vi } from "vitest";

import { GpuBreakdownQuerySchema } from "./gpu.schema";

describe("GpuBreakdownQuerySchema", () => {
  it("defaults startDate so the window covers the 30 days ending at endDate", () => {
    const result = GpuBreakdownQuerySchema.parse({ endDate: "2024-01-31" });

    expect(result.startDate).toBe("2024-01-02");
    expect(result.endDate).toBe("2024-01-31");
  });

  it("computes startDate in UTC regardless of the process timezone", () => {
    vi.stubEnv("TZ", "America/New_York");

    try {
      const result = GpuBreakdownQuerySchema.parse({ endDate: "2024-11-15" });

      expect(result.startDate).toBe("2024-10-17");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps the provided dates and filters untouched", () => {
    const result = GpuBreakdownQuerySchema.parse({ startDate: "2024-01-01", endDate: "2024-01-31", vendor: "nvidia", model: "h100" });

    expect(result).toEqual({ startDate: "2024-01-01", endDate: "2024-01-31", vendor: "nvidia", model: "h100" });
  });

  it("defaults endDate to today and covers 30 days when both dates are omitted", () => {
    const result = GpuBreakdownQuerySchema.parse({});

    expect(result.endDate).toBe(new Date().toISOString().split("T")[0]);
    const windowDays = (Date.parse(result.endDate) - Date.parse(result.startDate)) / (24 * 60 * 60 * 1000) + 1;
    expect(windowDays).toBe(30);
  });

  it("accepts a single-day range", () => {
    const result = GpuBreakdownQuerySchema.parse({ startDate: "2024-01-31", endDate: "2024-01-31" });

    expect(result.startDate).toBe("2024-01-31");
  });

  it("accepts a range of exactly 366 days", () => {
    const result = GpuBreakdownQuerySchema.parse({ startDate: "2024-01-01", endDate: "2024-12-31" });

    expect(result).toEqual({ startDate: "2024-01-01", endDate: "2024-12-31" });
  });

  it("rejects a range of 367 days", () => {
    expect(() => GpuBreakdownQuerySchema.parse({ startDate: "2024-01-01", endDate: "2025-01-01" })).toThrow(
      "Date range cannot exceed 366 days and startDate must not be after endDate"
    );
  });

  it("rejects a startDate after the endDate", () => {
    expect(() => GpuBreakdownQuerySchema.parse({ startDate: "2024-02-01", endDate: "2024-01-01" })).toThrow(
      "Date range cannot exceed 366 days and startDate must not be after endDate"
    );
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    expect(() => GpuBreakdownQuerySchema.parse({ startDate: "01/01/2024" })).toThrow();
  });
});
