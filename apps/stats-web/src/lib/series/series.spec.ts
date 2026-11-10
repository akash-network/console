import { describe, expect, it } from "vitest";

import type { SeriesPoint } from "./series";
import { axisTicks, daysOf, deltaPercent, fitSeries, labelIndexes, nearestIndex, sliceRange, summarize, toSeries } from "./series";

describe("series", () => {
  const padding = { top: 10, right: 20, bottom: 10, left: 10 };

  describe(toSeries.name, () => {
    it("swaps today's partial snapshot for the current value", () => {
      const now = Date.UTC(2026, 10, 9, 4);
      const graph = {
        snapshots: [
          { date: "2026-11-07T00:00:00.000Z", value: 2_000_000 },
          { date: "2026-11-08T00:00:00.000Z", value: 3_000_000 },
          { date: "2026-11-09T04:00:00.000Z", value: 100_000 }
        ],
        currentValue: 2_500_000,
        compareValue: 3_000_000
      };

      expect(toSeries(graph, value => value / 1e6, now)).toEqual([
        { time: Date.UTC(2026, 10, 7), value: 2 },
        { time: Date.UTC(2026, 10, 8), value: 3 },
        { time: now, value: 2.5 }
      ]);
    });

    it("keeps values as they are without a scale", () => {
      const graph = { snapshots: [{ date: "2026-11-09T00:00:00.000Z", value: 1 }], currentValue: 7, compareValue: 1 };

      expect(toSeries(graph, undefined, 5)).toEqual([{ time: 5, value: 7 }]);
    });

    it("is empty without snapshots", () => {
      expect(toSeries({ snapshots: [], currentValue: 7, compareValue: 1 })).toEqual([]);
    });
  });

  describe(daysOf.name, () => {
    it.each([
      ["7D", 7],
      ["30D", 30],
      ["90D", 90],
      ["1Y", 365],
      ["ALL", 0]
    ] as const)("maps %s to %d days", (range, days) => {
      expect(daysOf(range)).toBe(days);
    });
  });

  describe(sliceRange.name, () => {
    const series = points([1, 2, 3, 4, 5]);

    it("keeps the last days", () => {
      expect(sliceRange(series, 2).map(point => point.value)).toEqual([4, 5]);
    });

    it("keeps everything for all time", () => {
      expect(sliceRange(series, 0)).toBe(series);
    });

    it("keeps everything when the range is longer than the series", () => {
      expect(sliceRange(series, 5)).toBe(series);
    });
  });

  describe(deltaPercent.name, () => {
    const series = points([50, 80, 100, 120]);

    it("compares the latest value with the one a range earlier", () => {
      expect(deltaPercent(series, 2)).toBe(50);
    });

    it("compares with the first value for all time", () => {
      expect(deltaPercent(series, 0)).toBe(140);
    });

    it("compares with the first value when the range is longer than the series", () => {
      expect(deltaPercent(series, 30)).toBe(140);
    });

    it("is negative for a decline", () => {
      expect(deltaPercent(points([200, 150]), 1)).toBe(-25);
    });

    it("is unknown from a zero reference", () => {
      expect(deltaPercent(points([0, 10]), 1)).toBeUndefined();
    });

    it("is unknown without enough points", () => {
      expect(deltaPercent(points([10]), 1)).toBeUndefined();
    });
  });

  describe(fitSeries.name, () => {
    it("maps the lowest value to the bottom and the highest to the top", () => {
      const fitted = fitSeries(points([10, 30, 20]), 130, 120, padding);

      expect(fitted.min).toBe(10);
      expect(fitted.max).toBe(30);
      expect(fitted.yOf(10)).toBe(110);
      expect(fitted.yOf(30)).toBe(10);
      expect(fitted.xOf(0)).toBe(10);
      expect(fitted.xOf(2)).toBe(110);
      expect(fitted.line).toBe("M10.0 110.0L60.0 10.0L110.0 60.0");
      expect(fitted.area).toBe("M10.0 110.0L60.0 10.0L110.0 60.0L110.0 120L10.0 120Z");
    });

    it("centers a flat series", () => {
      const fitted = fitSeries(points([5, 5]), 130, 120, padding);

      expect(fitted.min).toBe(4);
      expect(fitted.max).toBe(6);
      expect(fitted.yOf(5)).toBe(60);
    });

    it("draws a single point at the left edge", () => {
      expect(fitSeries(points([5]), 130, 120, padding).line).toBe("M10.0 60.0");
    });

    it("draws nothing for an empty series", () => {
      const fitted = fitSeries([], 130, 120, padding);

      expect(fitted.line).toBe("");
      expect(fitted.area).toBe("");
    });
  });

  describe(axisTicks.name, () => {
    it("spreads ticks evenly from min to max", () => {
      expect(axisTicks(0, 30, 4)).toEqual([0, 10, 20, 30]);
    });
  });

  describe(labelIndexes.name, () => {
    it("spaces labels and leaves room before the last point", () => {
      expect(labelIndexes(90, 6)).toEqual([0, 15, 30, 45, 60, 75]);
    });

    it("labels every point of a short series", () => {
      expect(labelIndexes(3, 6)).toEqual([0, 1, 2]);
    });
  });

  describe(nearestIndex.name, () => {
    it("finds the point under the pointer", () => {
      expect(nearestIndex(64, 130, padding, 3)).toBe(1);
    });

    it("clamps before the first point", () => {
      expect(nearestIndex(0, 130, padding, 3)).toBe(0);
    });

    it("clamps after the last point", () => {
      expect(nearestIndex(500, 130, padding, 3)).toBe(2);
    });
  });

  describe(summarize.name, () => {
    it("finds the low, the high and the average", () => {
      const series = points([20, 5, 40, 15]);

      expect(summarize(series)).toEqual({ low: series[1], high: series[2], average: 20 });
    });
  });

  function points(values: number[]): SeriesPoint[] {
    return values.map((value, index) => ({ time: index * 86_400_000, value }));
  }
});
