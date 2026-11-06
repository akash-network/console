import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it, vi } from "vitest";

import { deploymentCostOf, type ResourceSpec } from "./deployment-cost";

const GIB = 1024 ** 3;

function unit(input: { cpuMillis: number; memoryBytes: number; storageBytes: number[]; gpus?: number; count?: number }) {
  return {
    resource: {
      id: 1,
      cpu: { units: { val: BigInt(input.cpuMillis) }, attributes: [] },
      memory: { quantity: { val: BigInt(input.memoryBytes) }, attributes: [] },
      storage: input.storageBytes.map((bytes, index) => ({ name: `volume-${index}`, quantity: { val: BigInt(bytes) }, attributes: [] })),
      gpu: { units: { val: BigInt(input.gpus ?? 0) }, attributes: [] },
      endpoints: []
    },
    count: input.count ?? 1,
    price: { denom: "uact", amount: "1000" }
  };
}

function groupOf(...units: ReturnType<typeof unit>[]): GroupSpec {
  return { name: "dcloud", requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] }, resources: units } as unknown as GroupSpec;
}

describe(deploymentCostOf.name, () => {
  it("adds up every service's typical price, times its count, across groups", () => {
    const { cost, typicalUsdPerMonthOf } = setup([
      groupOf(unit({ cpuMillis: 500, memoryBytes: GIB, storageBytes: [GIB, 2 * GIB], count: 2 })),
      groupOf(unit({ cpuMillis: 1000, memoryBytes: 2 * GIB, storageBytes: [GIB] }))
    ]);

    expect(typicalUsdPerMonthOf).toHaveBeenCalledWith({ cpuMillis: 500, memoryBytes: GIB, storageBytes: 3 * GIB });
    expect(typicalUsdPerMonthOf).toHaveBeenCalledWith({ cpuMillis: 1000, memoryBytes: 2 * GIB, storageBytes: GIB });
    expect(cost).toEqual({ estimatedUsdPerMonth: 2 * 0.75 + 1.25 });
  });

  it("gives no estimate for a deployment that requests a GPU", () => {
    const { cost, typicalUsdPerMonthOf } = setup([
      groupOf(unit({ cpuMillis: 500, memoryBytes: GIB, storageBytes: [GIB] }), unit({ cpuMillis: 8000, memoryBytes: 64 * GIB, storageBytes: [GIB], gpus: 1 }))
    ]);

    expect(cost).toEqual({ estimatedUsdPerMonth: null });
    expect(typicalUsdPerMonthOf).not.toHaveBeenCalled();
  });

  it.each([
    { case: "no resources", resource: undefined },
    { case: "resources without units", resource: { cpu: {}, memory: {}, storage: [{ name: "default" }], gpu: {} } },
    {
      case: "resources without values",
      resource: { cpu: { units: {} }, memory: { quantity: {} }, storage: [{ name: "default", quantity: {} }], gpu: { units: {} } }
    },
    { case: "empty resources", resource: {} }
  ])("prices a unit with $case as nothing requested", ({ resource }) => {
    const { cost, typicalUsdPerMonthOf } = setup([groupOf({ ...unit({ cpuMillis: 0, memoryBytes: 0, storageBytes: [] }), resource } as never)]);

    expect(typicalUsdPerMonthOf).toHaveBeenCalledWith({ cpuMillis: 0, memoryBytes: 0, storageBytes: 0 });
    expect(cost).toEqual({ estimatedUsdPerMonth: 0.25 });
  });

  it("rounds the estimate to the nearest cent", () => {
    const { cost } = setup([groupOf(unit({ cpuMillis: 100, memoryBytes: GIB, storageBytes: [] }))], () => 1.23556);

    expect(cost).toEqual({ estimatedUsdPerMonth: 1.24 });
  });

  function setup(groups: GroupSpec[], typical: (spec: ResourceSpec) => number = ({ cpuMillis }) => cpuMillis / 1000 + 0.25) {
    const typicalUsdPerMonthOf = vi.fn(typical);
    return { cost: deploymentCostOf(groups, typicalUsdPerMonthOf), typicalUsdPerMonthOf };
  }
});
