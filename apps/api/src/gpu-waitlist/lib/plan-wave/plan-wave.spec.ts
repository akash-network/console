import { describe, expect, it } from "vitest";

import { planWave } from "./plan-wave";

describe(planWave.name, () => {
  it("emails three people for one free node of eight when everyone wants eight", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({ id: `entry-${index}`, gpuCount: 8, isEligible: true }));

    const ids = planWave({ nodeFreeUnits: [8], entries, multiplier: 3 });

    expect(ids).toEqual(["entry-0", "entry-1", "entry-2"]);
  });

  it("fills several nodes in line order", () => {
    const entries = [
      { id: "a", gpuCount: 4, isEligible: true },
      { id: "b", gpuCount: 4, isEligible: true },
      { id: "c", gpuCount: 4, isEligible: true },
      { id: "d", gpuCount: 4, isEligible: true },
      { id: "e", gpuCount: 4, isEligible: true }
    ];

    const ids = planWave({ nodeFreeUnits: [4, 8], entries, multiplier: 1 });

    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("skips entries whose count fits no node", () => {
    const entries = [
      { id: "too-big", gpuCount: 8, isEligible: true },
      { id: "fits", gpuCount: 2, isEligible: true }
    ];

    const ids = planWave({ nodeFreeUnits: [4], entries, multiplier: 3 });

    expect(ids).toEqual(["fits"]);
  });

  it("skips ineligible entries without consuming a slot", () => {
    const entries = [
      { id: "trial", gpuCount: 8, isEligible: false },
      { id: "first", gpuCount: 8, isEligible: true },
      { id: "second", gpuCount: 8, isEligible: true }
    ];

    const ids = planWave({ nodeFreeUnits: [8], entries, multiplier: 1 });

    expect(ids).toEqual(["first"]);
  });

  it("emails nobody when no node has free units", () => {
    expect(planWave({ nodeFreeUnits: [], entries: [{ id: "a", gpuCount: 1, isEligible: true }], multiplier: 3 })).toEqual([]);
  });

  it("treats an unlimited node as large enough for every entry", () => {
    const entries = Array.from({ length: 5 }, (_, index) => ({ id: `e${index}`, gpuCount: 8, isEligible: true }));

    expect(planWave({ nodeFreeUnits: [Number.MAX_SAFE_INTEGER], entries, multiplier: 1 })).toHaveLength(5);
  });
});
