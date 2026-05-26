import { describe, expect, it } from "vitest";

import { MAX_INT64, ResourcePair } from "./resource-pair";

describe(ResourcePair.name, () => {
  describe("available", () => {
    it("returns the difference between allocatable and allocated", () => {
      const { pair } = setup({ allocatable: 100n, allocated: 30n });
      expect(pair.available()).toBe(70n);
    });

    it("clamps to zero when allocated exceeds allocatable", () => {
      const { pair } = setup({ allocatable: 10n, allocated: 20n });
      expect(pair.available()).toBe(0n);
    });

    it("returns zero when allocatable equals allocated", () => {
      const { pair } = setup({ allocatable: 50n, allocated: 50n });
      expect(pair.available()).toBe(0n);
    });

    it("returns -1 (unlimited) when allocatable is -1 sentinel", () => {
      const { pair } = setup({ allocatable: -1n, allocated: 0n });
      expect(pair.available()).toBe(MAX_INT64);
    });
  });

  describe("allocate (i.e., subNLZ in Golang)", () => {
    it("subtracts value and returns true when sufficient capacity", () => {
      const { pair } = setup({ allocatable: 100n, allocated: 30n });
      expect(pair.allocate(50n)).toBe(true);
      expect(pair.available()).toBe(20n);
    });

    it("returns false when insufficient capacity", () => {
      const { pair } = setup({ allocatable: 100n, allocated: 90n });
      expect(pair.allocate(20n)).toBe(false);
      expect(pair.available()).toBe(10n);
    });

    it("succeeds when value equals available", () => {
      const { pair } = setup({ allocatable: 100n, allocated: 50n });
      expect(pair.allocate(50n)).toBe(true);
      expect(pair.available()).toBe(0n);
    });

    it("succeeds with unlimited allocatable regardless of value", () => {
      const { pair } = setup({ allocatable: -1n, allocated: 0n });
      expect(pair.allocate(999999n)).toBe(true);
    });

    it("returns false when zero available", () => {
      const { pair } = setup({ allocatable: 10n, allocated: 10n });
      expect(pair.allocate(1n)).toBe(false);
    });
  });

  describe("clone", () => {
    it("creates an independent copy", () => {
      const { pair } = setup({ allocatable: 100n, allocated: 30n });
      const cloned = pair.clone();
      cloned.allocate(50n);
      expect(pair.available()).toBe(70n);
      expect(cloned.available()).toBe(20n);
    });
  });

  function setup(input: { allocatable: bigint; allocated: bigint }) {
    const pair = new ResourcePair(input.allocatable, input.allocated);
    return { pair };
  }
});
