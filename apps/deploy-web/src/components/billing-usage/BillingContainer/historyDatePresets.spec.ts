import { differenceInCalendarDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { getHistoryPresetRange } from "./historyDatePresets";

describe(getHistoryPresetRange.name, () => {
  const now = new Date(2026, 9, 2, 15, 30);

  it("ends every preset at the end of today", () => {
    expect(getHistoryPresetRange("last30Days", now).to).toEqual(new Date(2026, 9, 2, 23, 59, 59, 999));
  });

  it("covers the last 30 days including today", () => {
    const { from } = getHistoryPresetRange("last30Days", now);

    expect(from).toEqual(new Date(2026, 8, 3));
  });

  it("starts the last 3 months on the same day three months back", () => {
    expect(getHistoryPresetRange("last3Months", now).from).toEqual(new Date(2026, 6, 2));
  });

  it("keeps the last 12 months inside the API's 366-day limit", () => {
    const { from, to } = getHistoryPresetRange("last12Months", now);

    expect(from).toEqual(new Date(2025, 9, 2));
    expect(differenceInCalendarDays(to, from)).toBeLessThanOrEqual(366);
  });

  it("defaults to the current time", () => {
    const { to } = getHistoryPresetRange("last30Days");

    expect(differenceInCalendarDays(to, new Date())).toBe(0);
  });
});
