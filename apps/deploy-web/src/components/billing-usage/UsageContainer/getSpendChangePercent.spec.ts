import { describe, expect, it, onTestFinished, vi } from "vitest";

import { getSpendChangePercent } from "./getSpendChangePercent";

import { buildUsageHistoryItem } from "@tests/seeders/usage";

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

describe(getSpendChangePercent.name, () => {
  it("compares the daily spend rate against the previous period", () => {
    const history = [buildDay(3, 10), buildDay(2, 10), buildDay(1, 10)];

    expect(getSpendChangePercent({ history, previousTotalSpent: 24, previousDays: 3 })).toBeCloseTo(25, 6);
  });

  it("leaves today's partial spend out of the comparison", () => {
    const history = [buildDay(2, 10), buildDay(1, 10), buildDay(0, 2)];

    expect(getSpendChangePercent({ history, previousTotalSpent: 30, previousDays: 3 })).toBeCloseTo(0, 6);
  });

  it("leaves today's partial UTC day out of the comparison in the evening west of UTC", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T03:00:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const history = [
      buildUsageHistoryItem({ date: "2026-10-22", dailyUsdSpent: 10 }),
      buildUsageHistoryItem({ date: "2026-10-23", dailyUsdSpent: 10 }),
      buildUsageHistoryItem({ date: "2026-10-24", dailyUsdSpent: 2 })
    ];

    expect(getSpendChangePercent({ history, previousTotalSpent: 30, previousDays: 3 })).toBeCloseTo(0, 6);
  });

  it("reports a drop as a negative change", () => {
    const history = [buildDay(2, 5), buildDay(1, 5)];

    expect(getSpendChangePercent({ history, previousTotalSpent: 20, previousDays: 2 })).toBeCloseTo(-50, 6);
  });

  it("has no comparison when the previous period had no spend", () => {
    expect(getSpendChangePercent({ history: [buildDay(1, 10)], previousTotalSpent: 0, previousDays: 1 })).toBeNull();
  });

  it("has no comparison until the previous period loads", () => {
    expect(getSpendChangePercent({ history: [buildDay(1, 10)], previousTotalSpent: null, previousDays: 1 })).toBeNull();
  });

  it("has no comparison before a full day of the range has passed", () => {
    expect(getSpendChangePercent({ history: [buildDay(0, 10)], previousTotalSpent: 10, previousDays: 1 })).toBeNull();
  });

  it("has no comparison while the usage loads", () => {
    expect(getSpendChangePercent({ history: [], previousTotalSpent: 10, previousDays: 1 })).toBeNull();
  });
});

function buildDay(daysAgo: number, dailyUsdSpent: number) {
  return buildUsageHistoryItem({ date: new Date(Date.now() - daysAgo * MILLISECONDS_IN_DAY).toISOString().slice(0, 10), dailyUsdSpent });
}
