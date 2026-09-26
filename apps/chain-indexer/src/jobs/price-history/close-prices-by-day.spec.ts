import { describe, expect, it } from "vitest";

import { closePricesByDay } from "@src/jobs/price-history/close-prices-by-day";

describe(closePricesByDay.name, () => {
  it("keeps the last price of each utc day", () => {
    const closes = closePricesByDay([
      [Date.UTC(2026, 7, 11, 0, 0), 1.1],
      [Date.UTC(2026, 7, 11, 23, 59), 1.25],
      [Date.UTC(2026, 7, 12, 12, 0), 1.3]
    ]);

    expect([...closes.entries()]).toEqual([
      ["2026-08-11", 1.25],
      ["2026-08-12", 1.3]
    ]);
  });

  it("orders by time regardless of the input order", () => {
    const closes = closePricesByDay([
      [Date.UTC(2026, 7, 11, 23, 0), 2],
      [Date.UTC(2026, 7, 11, 1, 0), 1]
    ]);

    expect(closes.get("2026-08-11")).toBe(2);
  });

  it("is empty for no points", () => {
    expect(closePricesByDay([]).size).toBe(0);
  });
});
