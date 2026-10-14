import { describe, expect, it } from "vitest";

import { budgetPeriodOf } from "./budget-period";

describe(budgetPeriodOf.name, () => {
  it("spans the calendar month in UTC that holds the instant", () => {
    expect(budgetPeriodOf(new Date("2026-10-31T23:59:59.999Z"))).toEqual({
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-11-01T00:00:00.000Z"),
      key: "2026-10-01"
    });
  });

  it("rolls December over into the next year", () => {
    expect(budgetPeriodOf(new Date("2026-12-15T12:00:00.000Z"))).toEqual({
      from: new Date("2026-12-01T00:00:00.000Z"),
      to: new Date("2027-01-01T00:00:00.000Z"),
      key: "2026-12-01"
    });
  });

  it("starts a new period at midnight UTC on the first", () => {
    expect(budgetPeriodOf(new Date("2026-11-01T00:00:00.000Z")).key).toBe("2026-11-01");
  });
});
