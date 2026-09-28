import { describe, expect, it } from "vitest";

import { formatCountdown } from "./formatCountdown";

describe(formatCountdown.name, () => {
  it.each([
    [320, "5:20"],
    [165, "2:45"],
    [60, "1:00"],
    [59, "0:59"],
    [5, "0:05"],
    [0, "0:00"]
  ])("formats %i seconds as %s", (secondsLeft, expected) => {
    expect(formatCountdown(secondsLeft)).toBe(expected);
  });
});
