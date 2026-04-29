import { describe, expect, it } from "vitest";

import { computeInProgressBand } from "./computeInProgressBand";

describe(computeInProgressBand.name, () => {
  it("centers a one-day-wide band on today's coordinate when fully inside the plot area", () => {
    const result = computeInProgressBand({ todayX: 600, previousX: 500, plotAreaWidth: 1000 });
    expect(result).toEqual({ left: 550, width: 100 });
  });

  it("clamps the right edge to the plot area when today sits at the right margin", () => {
    const result = computeInProgressBand({ todayX: 980, previousX: 880, plotAreaWidth: 1000 });
    expect(result).toEqual({ left: 930, width: 70 });
  });

  it("clamps the left edge to zero when the band would extend past the plot area's left edge", () => {
    const result = computeInProgressBand({ todayX: 30, previousX: -70, plotAreaWidth: 1000 });
    expect(result).toEqual({ left: 0, width: 80 });
  });

  it("returns zero width when both edges fall past the plot area's right boundary", () => {
    const result = computeInProgressBand({ todayX: 1200, previousX: 1100, plotAreaWidth: 1000 });
    expect(result).toEqual({ left: 1000, width: 0 });
  });

  it("returns zero width when previous and today resolve to the same coordinate", () => {
    const result = computeInProgressBand({ todayX: 500, previousX: 500, plotAreaWidth: 1000 });
    expect(result).toEqual({ left: 500, width: 0 });
  });
});
