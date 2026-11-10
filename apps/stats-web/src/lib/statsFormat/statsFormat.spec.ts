import { describe, expect, it } from "vitest";

import {
  EMPTY_VALUE,
  formatAgo,
  formatBytes,
  formatCompact,
  formatDelta,
  formatHash,
  formatLongDate,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatUsd,
  formatUsdPrice
} from "./statsFormat";

describe("statsFormat", () => {
  describe(formatNumber.name, () => {
    it("groups thousands and rounds", () => {
      expect(formatNumber(1234567.6)).toBe("1,234,568");
    });

    it("shows a dash without a value", () => {
      expect(formatNumber(undefined)).toBe(EMPTY_VALUE);
    });
  });

  describe(formatCompact.name, () => {
    it.each([
      [9999, "9,999"],
      [10000, "10.0K"],
      [12840, "12.8K"],
      [999_999, "1000.0K"],
      [1_000_000, "1.00M"],
      [19_640_000, "19.64M"],
      [1_000_000_000, "1.00B"],
      [-25_000, "-25.0K"],
      [-2_500_000, "-2.50M"],
      [-3_000_000_000, "-3.00B"]
    ])("formats %d as %s", (value, expected) => {
      expect(formatCompact(value)).toBe(expected);
    });

    it("shows a dash without a value", () => {
      expect(formatCompact(undefined)).toBe(EMPTY_VALUE);
    });
  });

  describe(formatUsd.name, () => {
    it("prints whole dollars", () => {
      expect(formatUsd(46180.4)).toBe("$46,180");
    });

    it("prints compact dollars", () => {
      expect(formatUsd(19_640_000, { compact: true })).toBe("$19.64M");
    });

    it("shows a dash without a value", () => {
      expect(formatUsd(undefined)).toBe(EMPTY_VALUE);
    });
  });

  describe(formatUsdPrice.name, () => {
    it("prints cents", () => {
      expect(formatUsdPrice(2.4)).toBe("$2.40");
    });

    it("shows a dash without a value", () => {
      expect(formatUsdPrice(undefined)).toBe(EMPTY_VALUE);
    });
  });

  describe(formatBytes.name, () => {
    it.each([
      [418e9, "418 GB"],
      [51.2e12, "51.2 TB"],
      [2.61e15, "2.61 PB"],
      [100e12, "100 TB"],
      [10e9, "10.0 GB"]
    ])("formats %d bytes as %s", (value, expected) => {
      expect(formatBytes(value)).toBe(expected);
    });

    it("shows a dash without a value", () => {
      expect(formatBytes(undefined)).toBe(EMPTY_VALUE);
    });
  });

  describe(formatPercent.name, () => {
    it("prints one decimal", () => {
      expect(formatPercent(14.25)).toBe("14.3%");
    });

    it("signs a positive value when asked", () => {
      expect(formatPercent(3.21, { signed: true })).toBe("+3.2%");
    });

    it("does not sign zero", () => {
      expect(formatPercent(0, { signed: true })).toBe("0.0%");
    });

    it("keeps the minus of a negative value", () => {
      expect(formatPercent(-1.5, { signed: true })).toBe("-1.5%");
    });

    it("shows a dash without a value", () => {
      expect(formatPercent(undefined)).toBe(EMPTY_VALUE);
    });
  });

  describe(formatDelta.name, () => {
    it("points up for growth", () => {
      expect(formatDelta(16, "30D")).toBe("↗ +16.0% · 30D");
    });

    it("points up when flat", () => {
      expect(formatDelta(0, "7D")).toBe("↗ +0.0% · 7D");
    });

    it("points down for a decline", () => {
      expect(formatDelta(-4.25, "90D")).toBe("↘ -4.3% · 90D");
    });
  });

  describe("dates", () => {
    const time = Date.UTC(2026, 9, 26, 23, 30);

    it("prints a short utc date", () => {
      expect(formatShortDate(time)).toBe("Oct 26");
    });

    it("prints a long utc date", () => {
      expect(formatLongDate(time)).toBe("Oct 26, 2026");
    });
  });

  describe(formatAgo.name, () => {
    const now = Date.UTC(2026, 10, 9, 12);

    it.each([
      [0, "1s ago"],
      [59_000, "59s ago"],
      [60_000, "1m ago"],
      [3_599_000, "59m ago"],
      [3_600_000, "1h ago"],
      [86_399_000, "23h ago"],
      [86_400_000, "1d ago"],
      [3 * 86_400_000, "3d ago"]
    ])("prints %dms ago as %s", (elapsed, expected) => {
      expect(formatAgo(now - elapsed, now)).toBe(expected);
    });

    it("never prints a future time", () => {
      expect(formatAgo(now + 5000, now)).toBe("1s ago");
    });
  });

  describe(formatHash.name, () => {
    it("keeps the first six and last four characters", () => {
      expect(formatHash("ABCDEF0123456789")).toBe("ABCDEF…6789");
    });
  });
});
