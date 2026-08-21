import { describe, expect, it } from "vitest";

import { normalizeGroups } from "@src/akash/resources";

const base64Digits = (digits: string) => Buffer.from(digits, "ascii").toString("base64");

describe("normalizeGroups", () => {
  it("normalizes v1beta1 groups with base64 values and a single storage object", () => {
    const groups = normalizeGroups([
      {
        name: "g1",
        resources: [
          {
            resources: {
              cpu: { units: { val: base64Digits("1000") }, attributes: [] },
              memory: { quantity: { val: base64Digits("536870912") } },
              storage: { quantity: { val: base64Digits("268435456") }, attributes: [] }
            },
            count: 2,
            price: { denom: "uakt", amount: "50" }
          }
        ]
      }
    ]);

    expect(groups).toEqual([
      {
        gseq: 1,
        resources: [
          {
            count: 2,
            cpuUnits: 1000,
            gpuUnits: 0,
            gpuVendor: null,
            gpuModel: null,
            memoryBytes: 536870912,
            ephemeralStorageBytes: 268435456,
            persistentStorageBytes: 0,
            price: "50",
            priceDenom: "uakt"
          }
        ]
      }
    ]);
  });

  it("splits v1beta2+ storage arrays into ephemeral and persistent by attribute", () => {
    const groups = normalizeGroups([
      {
        resources: [
          {
            resources: {
              cpu: { units: { val: base64Digits("100") } },
              memory: { quantity: { val: base64Digits("1024") } },
              storage: [
                { quantity: { val: base64Digits("100") }, attributes: [] },
                { quantity: { val: base64Digits("200") }, attributes: [{ key: "persistent", value: "true" }] },
                { quantity: { val: base64Digits("50") }, attributes: [{ key: "persistent", value: "false" }] }
              ]
            },
            count: 1,
            price: { denom: "uakt", amount: "1" }
          }
        ]
      }
    ]);

    expect(groups[0].resources[0].ephemeralStorageBytes).toBe(150);
    expect(groups[0].resources[0].persistentStorageBytes).toBe(200);
  });

  it("normalizes chain-sdk groups with digit-string values, gpu attributes and the `resource` key", () => {
    const groups = normalizeGroups([
      {
        resources: [
          {
            resource: {
              cpu: { units: { val: "1000" } },
              gpu: { units: { val: "1" }, attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] },
              memory: { quantity: { val: "536870912" } },
              storage: [{ quantity: { val: "268435456" }, attributes: [] }]
            },
            count: 3,
            price: { denom: "uakt", amount: "50.5" }
          }
        ]
      }
    ]);

    expect(groups[0].resources[0]).toEqual({
      count: 3,
      cpuUnits: 1000,
      gpuUnits: 1,
      gpuVendor: "nvidia",
      gpuModel: "a100",
      memoryBytes: 536870912,
      ephemeralStorageBytes: 268435456,
      persistentStorageBytes: 0,
      price: "50.5",
      priceDenom: "uakt"
    });
  });

  it("treats a wildcard gpu model as any model", () => {
    const groups = normalizeGroups([
      {
        resources: [
          {
            resource: { gpu: { units: { val: "2" }, attributes: [{ key: "vendor/nvidia/model/*", value: "true" }] } },
            count: 1,
            price: { denom: "uakt", amount: "1" }
          }
        ]
      }
    ]);

    expect(groups[0].resources[0].gpuVendor).toBe("nvidia");
    expect(groups[0].resources[0].gpuModel).toBeNull();
  });

  it("assigns gseq by position and tolerates malformed groups", () => {
    const groups = normalizeGroups([{ resources: [] }, {}, null]);

    expect(groups.map(group => group.gseq)).toEqual([1, 2, 3]);
    expect(groups.every(group => group.resources.length === 0)).toBe(true);
  });

  it("returns no groups for a non-array input", () => {
    expect(normalizeGroups(undefined)).toEqual([]);
  });
});
