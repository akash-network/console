import { describe, expect, it } from "vitest";

import { countDaysInRange, getPreviousPeriod, getUsagePresetRange } from "./usageDatePresets";

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
