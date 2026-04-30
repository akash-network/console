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

  it("extracts storage volumes with quantity and attributes", () => {
    const { units } = setup({});
    expect(units[0].resources.storage).toEqual([
      {
        name: "default",
        quantity: 5368709120n,
        attributes: [
          { key: "persistent", value: "false" },
          { key: "class", value: "ephemeral" }
        ]
      }
    ]);
  });

  it("preserves CPU attributes", () => {
    const { units } = setup({});
    expect(units[0].resources.cpu.attributes).toEqual([]);
  });

  it("preserves replica count from request", () => {
    const { units } = setup({ count: 3 });
    expect(units[0].count).toBe(3);
  });

  it("handles multiple resource units", () => {
    const { units } = setup({ multiGroup: true });
    expect(units).toHaveLength(2);
    expect(units[1].resources.gpu.units).toBe(1n);
  });

  it("throws for invalid resource value string", () => {
    expect(() => setup({ invalidVal: true })).toThrow();
  });

  it("handles empty storage array", () => {
    const { units } = setup({ emptyStorage: true });
    expect(units[0].resources.storage).toEqual([]);
  });

  function setup(input: { count?: number; multiGroup?: boolean; invalidVal?: boolean; emptyStorage?: boolean }) {
    const baseResource = {
      id: 1,
      cpu: { units: { val: input.invalidVal ? "notanumber" : "1000" }, attributes: [] },
      memory: { quantity: { val: "1073741824" }, attributes: [] },
      gpu: { units: { val: "0" }, attributes: [] },
      storage: input.emptyStorage
        ? []
        : [
            {
              name: "default",
              quantity: { val: "5368709120" },
              attributes: [
                { key: "persistent", value: "false" },
                { key: "class", value: "ephemeral" }
              ]
            }
          ],
      endpoints: []
    };

    const resources: GroupSpecJSON["resources"] = [{ resource: baseResource, count: input.count ?? 1, price: { denom: "uakt", amount: "1000" } }];

    if (input.multiGroup) {
      resources.push({
        resource: {
          ...baseResource,
          id: 2,
          gpu: { units: { val: "1" }, attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] }
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
