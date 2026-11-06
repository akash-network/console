import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it, vi } from "vitest";

import { deploymentCostOf, type ResourceSpec } from "./deployment-cost";

const GIB = 1024 ** 3;
const BLOCKS_IN_A_MONTH = 438_292.8;

function unit(input: {
  cpuMillis: number;
  memoryBytes: number;
  storageBytes: number[];
  gpus?: number;
  count?: number;
  price?: { denom: string; amount: string };
}) {
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
    price: input.price ?? { denom: "uact", amount: "1000" }
  };
}

function groupOf(...units: ReturnType<typeof unit>[]): GroupSpec {
  return { name: "dcloud", requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] }, resources: units } as unknown as GroupSpec;
}

describe(deploymentCostOf.name, () => {
  it("adds up every service's typical price and price cap, times its count, across groups", () => {
    const { cost, typicalUsdPerMonthOf } = setup([
      groupOf(unit({ cpuMillis: 500, memoryBytes: GIB, storageBytes: [GIB, 2 * GIB], count: 2, price: { denom: "uact", amount: "1000" } })),
      groupOf(unit({ cpuMillis: 1000, memoryBytes: 2 * GIB, storageBytes: [GIB], price: { denom: "uact", amount: "500.5" } }))
    ]);

    expect(typicalUsdPerMonthOf).toHaveBeenCalledWith({ cpuMillis: 500, memoryBytes: GIB, storageBytes: 3 * GIB });
    expect(typicalUsdPerMonthOf).toHaveBeenCalledWith({ cpuMillis: 1000, memoryBytes: 2 * GIB, storageBytes: GIB });
    expect(cost).toEqual({
      estimatedUsdPerMonth: 2 * 0.75 + 1.25,
      maxUsdPerMonth: Math.round(((2 * 1000 + 500.5) * BLOCKS_IN_A_MONTH) / 10_000) / 100
    });
  });

  it("gives no estimate for a deployment that requests a GPU", () => {
    const { cost, typicalUsdPerMonthOf } = setup([
      groupOf(unit({ cpuMillis: 500, memoryBytes: GIB, storageBytes: [GIB] }), unit({ cpuMillis: 8000, memoryBytes: 64 * GIB, storageBytes: [GIB], gpus: 1 }))
    ]);

    expect(cost).toEqual({ estimatedUsdPerMonth: null, maxUsdPerMonth: 876.59 });
    expect(typicalUsdPerMonthOf).not.toHaveBeenCalled();
  });

  it("gives no price cap when a service is priced in another denom", () => {
    const { cost } = setup([
      groupOf(
        unit({ cpuMillis: 500, memoryBytes: GIB, storageBytes: [GIB] }),
        unit({ cpuMillis: 500, memoryBytes: GIB, storageBytes: [GIB], price: { denom: "uakt", amount: "1000" } })
      )
    ]);

    expect(cost).toEqual({ estimatedUsdPerMonth: 1.5, maxUsdPerMonth: null });
  });

  it.each([
    { case: "no resources", resource: undefined },
    { case: "resources without units", resource: { cpu: {}, memory: {}, storage: [{ name: "default" }], gpu: {} } },
    {
      case: "resources without values",
      resource: { cpu: { units: {} }, memory: { quantity: {} }, storage: [{ name: "default", quantity: {} }], gpu: { units: {} } }
    },
    { case: "empty resources", resource: {} }
  ])("prices a unit with $case as nothing requested and gives no price cap without a price", ({ resource }) => {
    const { cost, typicalUsdPerMonthOf } = setup([
      groupOf({ ...unit({ cpuMillis: 0, memoryBytes: 0, storageBytes: [] }), resource, price: undefined } as never)
    ]);

    expect(typicalUsdPerMonthOf).toHaveBeenCalledWith({ cpuMillis: 0, memoryBytes: 0, storageBytes: 0 });
    expect(cost).toEqual({ estimatedUsdPerMonth: 0.25, maxUsdPerMonth: null });
  });

  it("rounds both to cents", () => {
    const { cost } = setup([groupOf(unit({ cpuMillis: 100, memoryBytes: GIB, storageBytes: [] }))], () => 1.23456);

    expect(cost).toEqual({ estimatedUsdPerMonth: 1.23, maxUsdPerMonth: 438.29 });
  });

  function setup(groups: GroupSpec[], typical: (spec: ResourceSpec) => number = ({ cpuMillis }) => cpuMillis / 1000 + 0.25) {
    const typicalUsdPerMonthOf = vi.fn(typical);
    return { cost: deploymentCostOf(groups, typicalUsdPerMonthOf), typicalUsdPerMonthOf };
  }
});
