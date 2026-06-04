import { describe, expect, it } from "vitest";

import type { GroupSpecJSON } from "./groupspec-mapper";
import { mapGroupSpecToResourceUnits } from "./groupspec-mapper";

describe(mapGroupSpecToResourceUnits.name, () => {
  it("parses CPU units as bigint from string-encoded value", () => {
    const { units } = setup({});
    expect(units[0].resources.cpu.units).toBe(1000n);
  });

  it("parses memory quantity as bigint", () => {
    const { units } = setup({});
    expect(units[0].resources.memory.quantity).toBe(1073741824n);
  });

  it("parses GPU units as bigint", () => {
    const { units } = setup({});
    expect(units[0].resources.gpu.units).toBe(0n);
  });

  it("extracts storage volumes with quantity and parsed classification", () => {
    const { units } = setup({});
    expect(units[0].resources.storage).toEqual([
      {
        name: "default",
        quantity: 5368709120n,
        attributes: { persistent: false, class: "ephemeral", classification: "ephemeral" }
      }
    ]);
  });

  it("returns null CPU fingerprint when no attributes are declared", () => {
    const { units } = setup({});
    expect(units[0].resources.cpu.fingerprint).toBeNull();
  });

  it("computes a stable CPU fingerprint from sorted key=value attributes", () => {
    const { units } = setup({
      cpuAttributes: [
        { key: "arch", value: "amd64" },
        { key: "family", value: "epyc" }
      ]
    });
    expect(units[0].resources.cpu.fingerprint).toBe("arch=amd64,family=epyc");
  });

  it("returns an empty GPU parsedSpecs array when no GPU attributes are declared", () => {
    const { units } = setup({});
    expect(units[0].resources.gpu.attributes).toEqual([]);
  });

  it("preserves replica count from request", () => {
    const { units } = setup({ count: 3 });
    expect(units[0].count).toBe(3);
  });

  it("handles multiple resource units and parses GPU attributes per unit", () => {
    const { units } = setup({ multiGroup: true });
    expect(units).toHaveLength(2);
    expect(units[1].resources.gpu.units).toBe(1n);
    expect(units[1].resources.gpu.attributes).toEqual([{ vendor: "nvidia", model: "a100", ram: null, interface: null }]);
  });

  it("handles empty storage array", () => {
    const { units } = setup({ emptyStorage: true });
    expect(units[0].resources.storage).toEqual([]);
  });

  it("classifies ram-class storage volumes as ram", () => {
    const { units } = setup({
      storageOverride: [
        {
          name: "shm",
          quantity: { val: 2147483648n },
          attributes: [
            { key: "persistent", value: "false" },
            { key: "class", value: "ram" }
          ]
        }
      ]
    });
    expect(units[0].resources.storage[0].attributes).toEqual({ persistent: false, class: "ram", classification: "ram" });
  });

  it("classifies persistent-class storage volumes as persistent", () => {
    const { units } = setup({
      storageOverride: [
        {
          name: "data",
          quantity: { val: 53687091200n },
          attributes: [
            { key: "persistent", value: "true" },
            { key: "class", value: "beta2" }
          ]
        }
      ]
    });
    expect(units[0].resources.storage[0].attributes).toEqual({ persistent: true, class: "beta2", classification: "persistent" });
  });

  it("parses a fully-specified GPU spec with vendor/model/ram/interface", () => {
    const { units } = setup({
      gpuAttributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/pcie", value: "true" }]
    });
    expect(units[0].resources.gpu.attributes).toEqual([{ vendor: "nvidia", model: "a100", ram: "80Gi", interface: "pcie" }]);
  });

  function setup(input: {
    count?: number;
    multiGroup?: boolean;
    emptyStorage?: boolean;
    cpuAttributes?: { key: string; value: string }[];
    gpuAttributes?: { key: string; value: string }[];
    storageOverride?: { name: string; quantity: { val: bigint }; attributes: { key: string; value: string }[] }[];
  }) {
    const storage =
      input.storageOverride ??
      (input.emptyStorage
        ? []
        : [
            {
              name: "default",
              quantity: { val: 5368709120n },
              attributes: [
                { key: "persistent", value: "false" },
                { key: "class", value: "ephemeral" }
              ]
            }
          ]);

    const baseResource = {
      id: 1,
      cpu: { units: { val: 1000n }, attributes: input.cpuAttributes ?? [] },
      memory: { quantity: { val: 1073741824n }, attributes: [] },
      gpu: { units: { val: 0n }, attributes: input.gpuAttributes ?? [] },
      storage,
      endpoints: []
    };

    const resources: GroupSpecJSON["resources"] = [{ resource: baseResource, count: input.count ?? 1, price: { denom: "uakt", amount: "1000" } }];

    if (input.multiGroup) {
      resources.push({
        resource: {
          ...baseResource,
          id: 2,
          gpu: { units: { val: 1n }, attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] }
        },
        count: 1,
        price: { denom: "uakt", amount: "5000" }
      });
    }

    const request: GroupSpecJSON = {
      name: "westcoast",
      requirements: { signedBy: { allOf: [], anyOf: [] }, attributes: [] },
      resources
    };

    const units = mapGroupSpecToResourceUnits(request);
    return { units, request };
  }
});
