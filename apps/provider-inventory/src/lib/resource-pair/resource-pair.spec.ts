import { describe, expect, it } from "vitest";

import { availableCapacity, canAllocate, MAX_INT64 } from "./resource-pair";

describe(availableCapacity.name, () => {
  it("returns the difference between allocatable and allocated", () => {
    expect(availableCapacity({ allocatable: 100n, allocated: 30n })).toBe(70n);
  });

  it("clamps to zero when allocated exceeds allocatable", () => {
    expect(availableCapacity({ allocatable: 10n, allocated: 20n })).toBe(0n);
  });

  it("returns zero when allocatable equals allocated", () => {
    expect(availableCapacity({ allocatable: 50n, allocated: 50n })).toBe(0n);
  });

  it("returns MAX_INT64 when allocatable is the -1 unlimited sentinel", () => {
    expect(availableCapacity({ allocatable: -1n, allocated: 0n })).toBe(MAX_INT64);
  });
});

describe(canAllocate.name, () => {
  it("returns true when available capacity covers the requested value", () => {
    expect(canAllocate({ allocatable: 100n, allocated: 30n }, 50n)).toBe(true);
  });

  it("returns false when the requested value exceeds available capacity", () => {
    expect(canAllocate({ allocatable: 100n, allocated: 90n }, 20n)).toBe(false);
  });

  it("returns true when the requested value equals available capacity", () => {
    expect(canAllocate({ allocatable: 100n, allocated: 50n }, 50n)).toBe(true);
  });

  it("returns false when no capacity is available", () => {
    expect(canAllocate({ allocatable: 10n, allocated: 10n }, 1n)).toBe(false);
  });

  it("returns true for any value when allocatable is the -1 unlimited sentinel", () => {
    expect(canAllocate({ allocatable: -1n, allocated: 0n }, MAX_INT64)).toBe(true);
  });
});
