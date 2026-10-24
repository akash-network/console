import { describe, expect, it } from "vitest";

import { countDaysInRange, getPreviousPeriod, getPreviousSpendRange, getUsagePresetRange, toSpendRange } from "./usageDatePresets";

describe(getUsagePresetRange.name, () => {
  const now = new Date(2026, 9, 2, 15, 30);

  it.each([
    { preset: "last7Days", from: new Date(2026, 8, 26) },
    { preset: "last30Days", from: new Date(2026, 8, 3) },
    { preset: "last90Days", from: new Date(2026, 6, 5) },
    { preset: "last12Months", from: new Date(2025, 9, 2) }
  ] as const)("starts $preset at the beginning of its first day", ({ preset, from }) => {
    expect(getUsagePresetRange(preset, now).from).toEqual(from);
  });

  it("ends every preset at the end of today", () => {
    expect(getUsagePresetRange("last7Days", now).to).toEqual(new Date(2026, 9, 2, 23, 59, 59, 999));
  });
});

describe(getPreviousPeriod.name, () => {
  it("covers the same number of days right before the range", () => {
    const previous = getPreviousPeriod({ from: new Date(2026, 8, 3), to: new Date(2026, 9, 2, 23, 59, 59, 999) });

    expect(previous).toEqual({ from: new Date(2026, 7, 4), to: new Date(2026, 8, 2, 23, 59, 59, 999) });
  });

  it("covers the day before a single-day range", () => {
    const previous = getPreviousPeriod({ from: new Date(2026, 9, 2), to: new Date(2026, 9, 2, 23, 59, 59, 999) });

    expect(previous).toEqual({ from: new Date(2026, 9, 1), to: new Date(2026, 9, 1, 23, 59, 59, 999) });
  });
});

describe(countDaysInRange.name, () => {
  it("counts both the first and the last day", () => {
    expect(countDaysInRange({ from: new Date(2026, 8, 3), to: new Date(2026, 9, 2, 23, 59, 59, 999) })).toBe(30);
  });

  it("counts a single-day range as one day", () => {
    expect(countDaysInRange({ from: new Date(2026, 9, 2), to: new Date(2026, 9, 2, 23, 59, 59, 999) })).toBe(1);
  });
});

describe(toSpendRange.name, () => {
  const westOfUtcLast30Days = { from: new Date("2026-09-24T07:00:00.000Z"), to: new Date("2026-10-24T06:59:59.999Z") };

  it.each([
    { when: "in the evening", now: new Date("2026-10-24T03:00:00.000Z") },
    { when: "at the last moment of the day", now: new Date("2026-10-24T06:59:59.999Z") }
  ])("ends a range running to now west of UTC on today's UTC date $when, keeping its length", ({ now }) => {
    expect(toSpendRange(westOfUtcLast30Days, now)).toEqual({ startDate: "2026-09-25", endDate: "2026-10-24" });
  });

  it("ends a range running to now east of UTC on today's UTC date just after local midnight", () => {
    const eastOfUtcLast30Days = { from: new Date("2026-09-24T15:00:00.000Z"), to: new Date("2026-10-24T14:59:59.999Z") };

    expect(toSpendRange(eastOfUtcLast30Days, new Date("2026-10-23T16:00:00.000Z"))).toEqual({ startDate: "2026-09-24", endDate: "2026-10-23" });
  });

  it("keeps the last 12 months west of UTC to 366 days", () => {
    const westOfUtcLast12Months = { from: new Date("2025-10-23T07:00:00.000Z"), to: new Date("2026-10-24T06:59:59.999Z") };

    expect(toSpendRange(westOfUtcLast12Months, new Date("2026-10-24T03:00:00.000Z"))).toEqual({ startDate: "2025-10-24", endDate: "2026-10-24" });
  });

  it("keeps the days of a range that ended before now", () => {
    const june = { from: new Date(2026, 5, 1), to: new Date(2026, 5, 20, 23, 59, 59, 999) };

    expect(toSpendRange(june, new Date("2026-10-24T03:00:00.000Z"))).toEqual({ startDate: "2026-06-01", endDate: "2026-06-20" });
  });
});

describe(getPreviousSpendRange.name, () => {
  it("covers the same number of days right before the range", () => {
    expect(getPreviousSpendRange({ startDate: "2026-09-25", endDate: "2026-10-24" })).toEqual({ startDate: "2026-08-26", endDate: "2026-09-24" });
  });

  it("covers the day before a single-day range, across a year boundary", () => {
    expect(getPreviousSpendRange({ startDate: "2026-01-01", endDate: "2026-01-01" })).toEqual({ startDate: "2025-12-31", endDate: "2025-12-31" });
  });
});
