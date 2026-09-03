import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import { findTrialResourceViolation, sumGroupSpecResources } from "./group-resources";

describe("sumGroupSpecResources", () => {
  it("returns zero totals for empty or missing groups", () => {
    expect(sumGroupSpecResources([])).toEqual({ cpuMillis: 0, memoryBytes: 0 });
    expect(sumGroupSpecResources(undefined)).toEqual({ cpuMillis: 0, memoryBytes: 0 });
  });

  it("sums cpu and memory across groups and resource units", () => {
    const groups = [
      createGroup([{ cpuMillis: 1000n, memoryBytes: BigInt(1024 ** 3) }]),
      createGroup([{ cpuMillis: 500n, memoryBytes: BigInt(2 * 1024 ** 3) }])
    ];

    expect(sumGroupSpecResources(groups)).toEqual({ cpuMillis: 1500, memoryBytes: 3 * 1024 ** 3 });
  });

  it("multiplies resource units by their replica count", () => {
    const groups = [createGroup([{ cpuMillis: 1000n, memoryBytes: BigInt(1024 ** 3), count: 3 }])];

    expect(sumGroupSpecResources(groups)).toEqual({ cpuMillis: 3000, memoryBytes: 3 * 1024 ** 3 });
  });

  it("treats a zero replica count as a single replica", () => {
    const groups = [createGroup([{ cpuMillis: 1000n, count: 0 }])];

    expect(sumGroupSpecResources(groups).cpuMillis).toBe(1000);
  });

  it("decodes wire-encoded Uint8Array resource values", () => {
    const groups = [createGroup([{ cpuMillis: new TextEncoder().encode("16000") as unknown as bigint }])];

    expect(sumGroupSpecResources(groups).cpuMillis).toBe(16_000);
  });

  it("counts missing cpu and memory as zero", () => {
    const groups = [createGroup([{}])];

    expect(sumGroupSpecResources(groups)).toEqual({ cpuMillis: 0, memoryBytes: 0 });
  });
});

describe("findTrialResourceViolation", () => {
  it("returns undefined when both limits are disabled", () => {
    const groups = [createGroup([{ cpuMillis: 64_000n, memoryBytes: BigInt(128 * 1024 ** 3) }])];

    expect(findTrialResourceViolation(groups, { maxCpu: 0, maxMemoryGi: 0 })).toBeUndefined();
  });

  it("returns undefined when totals are within the limits", () => {
    const groups = [createGroup([{ cpuMillis: 4000n, memoryBytes: BigInt(16 * 1024 ** 3) }])];

    expect(findTrialResourceViolation(groups, { maxCpu: 4, maxMemoryGi: 16 })).toBeUndefined();
  });

  it("reports a cpu violation with the requested amount in the message", () => {
    const groups = [createGroup([{ cpuMillis: 16_000n }])];

    expect(findTrialResourceViolation(groups, { maxCpu: 4, maxMemoryGi: 16 })).toMatchObject({
      kind: "cpu",
      cpuMillis: 16_000,
      message: expect.stringContaining("limited to 4 CPU. Requested 16 CPU")
    });
  });

  it("reports a memory violation when only memory exceeds its limit", () => {
    const groups = [createGroup([{ cpuMillis: 1000n, memoryBytes: BigInt(24 * 1024 ** 3) }])];

    expect(findTrialResourceViolation(groups, { maxCpu: 4, maxMemoryGi: 16 })).toMatchObject({
      kind: "memory",
      message: expect.stringContaining("limited to 16Gi of memory. Requested 24Gi")
    });
  });

  it("checks only the enabled limit", () => {
    const groups = [createGroup([{ cpuMillis: 64_000n, memoryBytes: BigInt(128 * 1024 ** 3) }])];

    expect(findTrialResourceViolation(groups, { maxCpu: 0, maxMemoryGi: 16 })).toMatchObject({ kind: "memory" });
    expect(findTrialResourceViolation(groups, { maxCpu: 4, maxMemoryGi: 0 })).toMatchObject({ kind: "cpu" });
  });
});

function createGroup(units: { cpuMillis?: bigint; memoryBytes?: bigint; count?: number }[]): GroupSpec {
  return {
    name: "test",
    requirements: undefined,
    resources: units.map(unit => ({
      resource: {
        id: 1,
        cpu: unit.cpuMillis === undefined ? undefined : { units: { val: unit.cpuMillis }, attributes: [] },
        memory: unit.memoryBytes === undefined ? undefined : { quantity: { val: unit.memoryBytes }, attributes: [] },
        gpu: undefined,
        storage: [],
        endpoints: []
      },
      count: unit.count ?? 1,
      price: undefined
    }))
  };
}
