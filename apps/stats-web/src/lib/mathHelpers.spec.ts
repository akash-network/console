import { describe, expect, it } from "vitest";

import { nFormatter, percIncrease } from "./mathHelpers";

describe(nFormatter.name, () => {
  it("formats positive values below 1k without a suffix", () => {
    expect(nFormatter(0, 2)).toBe("0");
    expect(nFormatter(42, 2)).toBe("42");
  });

  it("formats positive values with the matching suffix", () => {
    expect(nFormatter(1500, 2)).toBe("1.5k");
    expect(nFormatter(2_500_000, 2)).toBe("2.5M");
  });

  it("formats negative values with the matching suffix", () => {
    expect(nFormatter(-1500, 2)).toBe("-1.5k");
    expect(nFormatter(-2_500_000, 2)).toBe("-2.5M");
    expect(nFormatter(-200_000, 2)).toBe("-200k");
  });

  it("formats small negative values without a suffix", () => {
    expect(nFormatter(-42, 2)).toBe("-42");
  });
});

describe(percIncrease.name, () => {
  it("returns standard percentage change for non-zero values", () => {
    expect(percIncrease(100, 150)).toBe(0.5);
  });

  it("returns negative percentage for decrease", () => {
    expect(percIncrease(200, 100)).toBe(-0.5);
  });

  it("returns 0 when both values are 0", () => {
    expect(percIncrease(0, 0)).toBe(0);
  });

  it("returns 0 when baseline is 0 to avoid meaningless percentage", () => {
    expect(percIncrease(0, 1000)).toBe(0);
  });

  it("returns 0 when baseline is 0 even for large values", () => {
    expect(percIncrease(0, 21570000000000)).toBe(0);
  });

  it("returns -1 when value drops to 0", () => {
    expect(percIncrease(100, 0)).toBe(-1);
  });

  it("returns 0 when values are equal", () => {
    expect(percIncrease(100, 100)).toBe(0);
  });
});
