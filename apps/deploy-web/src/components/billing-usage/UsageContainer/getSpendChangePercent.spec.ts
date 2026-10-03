import { format, startOfToday, subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { getSpendChangePercent } from "./getSpendChangePercent";

import { buildUsageHistoryItem } from "@tests/seeders/usage";

describe(getSpendChangePercent.name, () => {
  it("compares the daily spend rate against the previous period", () => {
    const history = [buildDay(3, 10), buildDay(2, 10), buildDay(1, 10)];

    expect(getSpendChangePercent({ history, previousTotalSpent: 24, previousDays: 3 })).toBeCloseTo(25, 6);
  });

  it("leaves today's partial spend out of the comparison", () => {
    const history = [buildDay(2, 10), buildDay(1, 10), buildDay(0, 2)];

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
  return buildUsageHistoryItem({ date: format(subDays(startOfToday(), daysAgo), "yyyy-MM-dd"), dailyUsdSpent });
}
