import { describe, expect, it } from "vitest";

import { balanceSnapshotRunAtOn, nextBalanceSnapshotRunAt, utcDayAfter, utcDayOf } from "./balance-snapshot-schedule";

describe(nextBalanceSnapshotRunAt.name, () => {
  it.each([
    ["earlier the same UTC day", "2026-11-28T00:14:59.999Z", "2026-11-28T00:15:00.000Z"],
    ["at the very moment of today's run", "2026-11-28T00:15:00.000Z", "2026-11-29T00:15:00.000Z"],
    ["later the same UTC day", "2026-11-28T17:40:00.000Z", "2026-11-29T00:15:00.000Z"],
    ["on the last day of a month", "2026-11-30T23:59:59.000Z", "2026-12-01T00:15:00.000Z"]
  ])("picks the next quarter past midnight UTC when asked %s", (_case, now, expected) => {
    expect(nextBalanceSnapshotRunAt(new Date(now)).toISOString()).toBe(expected);
  });
});

describe(balanceSnapshotRunAtOn.name, () => {
  it("is a quarter past midnight UTC of the day asked for", () => {
    expect(balanceSnapshotRunAtOn("2026-11-28").toISOString()).toBe("2026-11-28T00:15:00.000Z");
  });
});

describe(utcDayAfter.name, () => {
  it.each([
    ["2026-11-28", "2026-11-29"],
    ["2026-11-30", "2026-12-01"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-28", "2028-02-29"]
  ])("names the day after %s", (day, expected) => {
    expect(utcDayAfter(day)).toBe(expected);
  });
});

describe(utcDayOf.name, () => {
  it.each([
    ["2026-11-28T00:15:00.000Z", "2026-11-28"],
    ["2026-11-28T23:59:59.999Z", "2026-11-28"],
    ["2026-11-28T19:30:00.000-08:00", "2026-11-29"]
  ])("names the UTC day of %s", (instant, expected) => {
    expect(utcDayOf(new Date(instant))).toBe(expected);
  });
});
