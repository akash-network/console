import { describe, expect, it } from "vitest";

import { spendShade } from "./spendShade";

describe(spendShade.name, () => {
  it("fades from the full foreground for the first of a ranking to a quarter of it for the last", () => {
    expect([0, 1, 2].map(index => spendShade(index, 3))).toEqual([shadeOf(100), shadeOf(63), shadeOf(25)]);
  });

  it("gives a ranking of one the full foreground", () => {
    expect(spendShade(0, 1)).toBe(shadeOf(100));
  });

  function shadeOf(foregroundPercent: number) {
    return `color-mix(in oklab, hsl(var(--foreground)) ${foregroundPercent}%, hsl(var(--muted)))`;
  }
});
