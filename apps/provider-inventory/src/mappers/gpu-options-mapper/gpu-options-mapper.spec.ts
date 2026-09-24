import { describe, expect, it } from "vitest";

import type { AvailableGpu } from "@src/repositories/placement-options/placement-options.repository";
import { mapToGpuVendorOptions } from "./gpu-options-mapper";

describe(mapToGpuVendorOptions.name, () => {
  it("groups models under their vendor", () => {
    const options = mapToGpuVendorOptions([gpu({ vendor: "nvidia", model: "a100" }), gpu({ vendor: "amd", model: "mi100" })]);

    expect(options).toEqual([
      {
        vendor: "nvidia",
        models: [
          {
            name: "a100",
            memory: ["40Gi"],
            interface: ["pcie"],
            providerCount: 1,
            variants: [
              { memory: null, interface: null, providerCount: 1 },
              { memory: "40Gi", interface: null, providerCount: 1 },
              { memory: null, interface: "pcie", providerCount: 1 },
              { memory: "40Gi", interface: "pcie", providerCount: 1 }
            ]
          }
        ]
      },
      {
        vendor: "amd",
        models: [
          {
            name: "mi100",
            memory: ["40Gi"],
            interface: ["pcie"],
            providerCount: 1,
            variants: [
              { memory: null, interface: null, providerCount: 1 },
              { memory: "40Gi", interface: null, providerCount: 1 },
              { memory: null, interface: "pcie", providerCount: 1 },
              { memory: "40Gi", interface: "pcie", providerCount: 1 }
            ]
          }
        ]
      }
    ]);
  });

  it("counts each combination by the providers advertising exactly its key", () => {
    const options = mapToGpuVendorOptions([
      gpu({ owner: "akash1memoryFirst", model: "h100", memory: "80Gi", interface: "SXM5" }),
      gpu({
        owner: "akash1interfaceFirst",
        model: "h100",
        memory: "80Gi",
        interface: "SXM5",
        advertisedGpuKeys: [
          "vendor/nvidia/model/h100",
          "vendor/nvidia/model/h100/ram/80Gi",
          "vendor/nvidia/model/h100/interface/sxm",
          "vendor/nvidia/model/h100/interface/sxm/ram/80Gi"
        ]
      })
    ]);

    expect(options[0].models[0].variants).toEqual([
      { memory: null, interface: null, providerCount: 2 },
      { memory: "80Gi", interface: null, providerCount: 2 },
      { memory: null, interface: "sxm", providerCount: 2 },
      { memory: "80Gi", interface: "sxm", providerCount: 1 }
    ]);
  });

  it("leaves out a model no provider advertises on its own", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "a100", advertisedGpuKeys: ["vendor/nvidia/model/a100/ram/40Gi/interface/pcie"] })]);

    expect(options).toEqual([]);
  });

  it("leaves out a model its provider advertises under another name", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "rtx4090", advertisedGpuKeys: ["vendor/nvidia/model/4090"] })]);

    expect(options).toEqual([]);
  });

  it("offers a memory size or interface only when a provider advertises the model with it", () => {
    const options = mapToGpuVendorOptions([
      gpu({ model: "a100", memory: "40Gi", interface: "pcie", advertisedGpuKeys: ["vendor/nvidia/model/a100", "vendor/nvidia/model/a100/interface/pcie"] })
    ]);

    expect(options[0].models[0]).toMatchObject({ memory: [], interface: ["pcie"] });
  });

  it("keeps a combination advertised only with both memory and interface out of the single-value lists", () => {
    const options = mapToGpuVendorOptions([
      gpu({
        model: "a100",
        memory: "40Gi",
        interface: "pcie",
        advertisedGpuKeys: ["vendor/nvidia/model/a100", "vendor/nvidia/model/a100/ram/40Gi/interface/pcie"]
      })
    ]);

    expect(options[0].models[0]).toMatchObject({
      memory: [],
      interface: [],
      variants: [
        { memory: null, interface: null, providerCount: 1 },
        { memory: "40Gi", interface: "pcie", providerCount: 1 }
      ]
    });
  });

  it("counts each provider advertising a model once", () => {
    const options = mapToGpuVendorOptions([
      gpu({ owner: "akash1first", model: "a100", memory: "40Gi" }),
      gpu({ owner: "akash1first", model: "a100", memory: "80Gi" }),
      gpu({ owner: "akash1second", model: "a100", memory: "40Gi" }),
      gpu({ owner: "akash1first", model: "h100" })
    ]);

    expect(options[0].models.map(model => [model.name, model.providerCount])).toEqual([
      ["a100", 2],
      ["h100", 1]
    ]);
  });

  it("serves an interface the way an SDL spells it", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "h100", interface: "SXM5" }), gpu({ model: "rtx4090", interface: "PCIe" })]);

    expect(options[0].models.map(model => [model.name, model.interface])).toEqual([
      ["h100", ["sxm"]],
      ["rtx4090", ["pcie"]]
    ]);
  });

  it("lists every sxm revision a model ships with as the one sxm interface", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "a100", interface: "SXM4" }), gpu({ model: "a100", interface: "sxm5" })]);

    expect(options[0].models[0].interface).toEqual(["sxm"]);
  });

  it("offers no interface an SDL cannot carry", () => {
    const options = mapToGpuVendorOptions([
      gpu({
        vendor: "amd",
        model: "mi300x",
        memory: "192Gi",
        interface: "OAM",
        advertisedGpuKeys: ["vendor/amd/model/mi300x", "vendor/amd/model/mi300x/interface/oam"]
      })
    ]);

    expect(options[0].models[0]).toMatchObject({ interface: [], variants: [{ memory: null, interface: null, providerCount: 1 }] });
  });

  it("leaves out memory sizes and interfaces the provider did not report", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "h100", memory: "", interface: "" })]);

    expect(options).toEqual([
      {
        vendor: "nvidia",
        models: [{ name: "h100", memory: [], interface: [], providerCount: 1, variants: [{ memory: null, interface: null, providerCount: 1 }] }]
      }
    ]);
  });

  it("keeps every distinct model of a vendor", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "a100" }), gpu({ model: "h100" }), gpu({ model: "a100" })]);

    expect(options[0].models.map(model => model.name)).toEqual(["a100", "h100"]);
  });

  it("returns no vendor when nothing is available", () => {
    expect(mapToGpuVendorOptions([])).toEqual([]);
  });

  function gpu(input: Partial<AvailableGpu>): AvailableGpu {
    const vendor = input.vendor ?? "nvidia";
    const model = input.model ?? "a100";
    const memory = input.memory ?? "40Gi";
    const gpuInterface = input.interface ?? "pcie";
    const sdlInterface = /^sxm\d*$/i.test(gpuInterface) ? "sxm" : gpuInterface.toLowerCase();
    const base = `vendor/${vendor}/model/${model}`;

    return {
      owner: input.owner ?? "akash1provider",
      vendor,
      model,
      memory,
      interface: gpuInterface,
      advertisedGpuKeys: input.advertisedGpuKeys ?? [
        base,
        `${base}/ram/${memory}`,
        `${base}/interface/${sdlInterface}`,
        `${base}/ram/${memory}/interface/${sdlInterface}`
      ]
    };
  }
});
