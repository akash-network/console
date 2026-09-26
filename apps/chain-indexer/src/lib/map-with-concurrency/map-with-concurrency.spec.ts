import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "@src/lib/map-with-concurrency/map-with-concurrency";

describe(mapWithConcurrency.name, () => {
  it("returns results in input order even when workers finish out of order", async () => {
    const results = await mapWithConcurrency([30, 10, 20], 3, async ms => {
      await delay(ms);
      return ms * 2;
    });

    expect(results).toEqual([60, 20, 40]);
  });

  it("never runs more workers than the limit at once", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async () => {
      active++;
      peak = Math.max(peak, active);
      await delay(5);
      active--;
    });

    expect(peak).toBe(2);
  });

  it("resolves to an empty list for no items", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
