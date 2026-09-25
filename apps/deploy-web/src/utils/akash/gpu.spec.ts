import { describe, expect, it } from "vitest";

import type { AvailableGpuVendor } from "@src/queries/usePlacementOptions";
import type { GpuVendor } from "@src/types/gpu";
import type { GpuModel } from "@src/types/gpu";
import {
  findUnavailableGpuModels,
  listGpuInterfaceOptions,
  listGpuMemoryOptions,
  narrowGpuVendorsToAvailable,
  prioritizeGpuModels,
  withPinnedGpu
} from "./gpu";

describe("prioritizeGpuModels", () => {
  it("floats prioritized models to the top in priority order", () => {
    const models = [{ name: "t4" }, { name: "rtx4090" }, { name: "a100" }, { name: "h100" }, { name: "h200" }];

    expect(prioritizeGpuModels(models).map(model => model.name)).toEqual(["h100", "a100", "h200", "rtx4090", "t4"]);
  });

  it("raises both pro6000 variants with the single pro6000 entry, preserving their order", () => {
    const models = [{ name: "t4" }, { name: "pro6000we" }, { name: "pro6000se" }];

    expect(prioritizeGpuModels(models).map(model => model.name)).toEqual(["pro6000we", "pro6000se", "t4"]);
  });

  it("keeps unmatched models in their original order", () => {
    const models = [{ name: "t4" }, { name: "v100" }, { name: "a2000" }];

    expect(prioritizeGpuModels(models).map(model => model.name)).toEqual(["t4", "v100", "a2000"]);
  });

  it("matches regardless of case and separators in the model name", () => {
    const models = [{ name: "RTX-4090" }, { name: "PRO 6000 SE" }, { name: "H100" }];

    expect(prioritizeGpuModels(models).map(model => model.name)).toEqual(["H100", "PRO 6000 SE", "RTX-4090"]);
  });

  it("ranks by the given priority list over the models' input order", () => {
    const models = [{ name: "a100" }, { name: "t4" }];

    expect(prioritizeGpuModels(models, ["t4", "a100"]).map(model => model.name)).toEqual(["t4", "a100"]);
  });
});

describe(narrowGpuVendorsToAvailable.name, () => {
  const CATALOG: GpuVendor[] = [
    {
      name: "nvidia",
      displayName: "NVIDIA",
      models: [
        { name: "a100", displayName: "A100", memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] },
        { name: "t4", displayName: "T4", memory: ["16Gi"], interface: ["pcie"] }
      ]
    },
    { name: "amd", displayName: "AMD", models: [{ name: "mi300", memory: ["192Gi"], interface: ["pcie"] }] }
  ];

  it("keeps only the vendors and models providers currently offer", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("t4", ["16Gi"], ["pcie"])] }]);

    expect(narrowed).toEqual([
      { name: "nvidia", displayName: "NVIDIA", models: [{ name: "t4", displayName: "T4", memory: ["16Gi"], interface: ["pcie"], providerCount: 1 }] }
    ]);
  });

  it("carries how many providers have free capacity for each model", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("t4", ["16Gi"], ["pcie"], 4)] }]);

    expect(narrowed?.[0].models[0].providerCount).toBe(4);
  });

  it("keeps only the memory sizes and interfaces the model is available with", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("a100", ["80Gi"], ["sxm"])] }]);

    expect(narrowed?.[0].models[0]).toMatchObject({ memory: ["80Gi"], interface: ["sxm"] });
  });

  it("offers a model the catalog does not list, without a display name", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("b200", ["180Gi"], ["sxm"])] }]);

    expect(narrowed?.[0].models[0]).toEqual({ name: "b200", displayName: undefined, memory: ["180Gi"], interface: ["sxm"], providerCount: 1 });
  });

  it("offers a model the catalog does not list with nothing to pick when providers report no memory or interface", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("b200", [], [])] }]);

    expect(narrowed?.[0].models[0]).toMatchObject({ memory: [], interface: [] });
  });

  it("falls back to the catalog memory and interface when providers report none", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("a100", [], [])] }]);

    expect(narrowed?.[0].models[0]).toMatchObject({ memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] });
  });

  it("carries the memory and interface combinations providers would bid on", () => {
    const variants = [
      { memory: null, interface: null, providerCount: 2 },
      { memory: "80Gi", interface: "sxm", providerCount: 1 }
    ];

    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [{ ...model("a100", [], []), variants }] }]);

    expect(narrowed?.[0].models[0].variants).toEqual(variants);
  });

  it("reads an availability answer from before combinations were served as having none", () => {
    const answerWithoutVariants = { name: "a100", memory: ["80Gi"], interface: ["sxm"], providerCount: 1 } as AvailableGpuVendor["models"][number];

    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [answerWithoutVariants] }]);

    expect(narrowed?.[0].models[0]).toMatchObject({ memory: ["80Gi"], interface: ["sxm"], variants: undefined });
  });

  it("leaves the combinations out of an availability answer that has none", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("a100", ["80Gi"], ["sxm"])] }]);

    expect(narrowed?.[0].models[0].variants).toBeUndefined();
  });

  it("leaves the catalog untouched when availability is absent", () => {
    expect(narrowGpuVendorsToAvailable(CATALOG, undefined)).toBe(CATALOG);
  });

  it("leaves the catalog untouched when no gpu is reported available", () => {
    expect(narrowGpuVendorsToAvailable(CATALOG, [])).toBe(CATALOG);
  });

  it("reports no catalog when there is neither a catalog nor availability", () => {
    expect(narrowGpuVendorsToAvailable(undefined, undefined)).toBeUndefined();
  });

  function model(name: string, memory: string[], gpuInterface: string[], providerCount = 1): AvailableGpuVendor["models"][number] {
    return { name, memory, interface: gpuInterface, providerCount, variants: [] };
  }
});

describe(findUnavailableGpuModels.name, () => {
  const CATALOG: GpuVendor[] = [
    {
      name: "nvidia",
      displayName: "NVIDIA",
      models: [
        { name: "a100", displayName: "A100", memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] },
        { name: "t4", displayName: "T4", memory: ["16Gi"], interface: ["pcie"] }
      ]
    },
    { name: "amd", displayName: "AMD", models: [{ name: "mi300", memory: ["192Gi"], interface: ["pcie"] }] }
  ];
  const AVAILABLE: AvailableGpuVendor[] = [
    { vendor: "nvidia", models: [{ name: "t4", memory: ["16Gi"], interface: ["pcie"], providerCount: 2, variants: [] }] }
  ];

  it("lists the catalog models of the vendor that no provider offers", () => {
    expect(findUnavailableGpuModels(CATALOG, AVAILABLE, { vendor: "nvidia" })).toEqual([CATALOG[0].models[0]]);
  });

  it("lists every catalog model of a vendor no provider offers", () => {
    expect(findUnavailableGpuModels(CATALOG, AVAILABLE, { vendor: "amd" })).toEqual(CATALOG[1].models);
  });

  it("adds a pinned model no provider offers when the catalog does not list it", () => {
    const unavailable = findUnavailableGpuModels(CATALOG, AVAILABLE, { vendor: "nvidia", name: "b100" });

    expect(unavailable.map(model => model.name)).toEqual(["b100", "a100"]);
  });

  it("leaves out a pinned model a provider offers", () => {
    expect(findUnavailableGpuModels(CATALOG, AVAILABLE, { vendor: "nvidia", name: "t4" }).map(model => model.name)).toEqual(["a100"]);
  });

  it("looks only at what providers offer for the pinned vendor", () => {
    const available: AvailableGpuVendor[] = [
      ...AVAILABLE,
      { vendor: "amd", models: [{ name: "mi300", memory: ["192Gi"], interface: ["pcie"], providerCount: 1, variants: [] }] }
    ];

    expect(findUnavailableGpuModels(CATALOG, available, { vendor: "amd" })).toEqual([]);
  });

  it("lists a pinned model of a vendor the catalog does not know", () => {
    expect(findUnavailableGpuModels(CATALOG, AVAILABLE, { vendor: "intel", name: "gaudi2" })).toEqual([{ name: "gaudi2", memory: [], interface: [] }]);
  });

  it("lists nothing while availability is absent or empty", () => {
    expect(findUnavailableGpuModels(CATALOG, undefined, { vendor: "nvidia" })).toEqual([]);
    expect(findUnavailableGpuModels(CATALOG, [], { vendor: "nvidia" })).toEqual([]);
  });

  it("lists nothing before a vendor is picked", () => {
    expect(findUnavailableGpuModels(CATALOG, AVAILABLE, { vendor: "" })).toEqual([]);
  });
});

describe(withPinnedGpu.name, () => {
  const AVAILABLE: GpuVendor[] = [{ name: "nvidia", displayName: "NVIDIA", models: [{ name: "t4", memory: ["16Gi"], interface: ["pcie"], providerCount: 2 }] }];

  it("adds a pinned vendor and its model that no provider offers", () => {
    const merged = withPinnedGpu(AVAILABLE, { vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" });

    expect(merged).toEqual([
      ...AVAILABLE,
      { name: "amd", displayName: undefined, models: [{ name: "mi300", displayName: undefined, memory: ["192Gi"], interface: ["pcie"] }] }
    ]);
  });

  it("adds a pinned model to a vendor that is available", () => {
    const merged = withPinnedGpu(AVAILABLE, { vendor: "nvidia", name: "a100", memory: "80Gi", interface: "sxm" });

    expect(merged?.[0].models.map(model => model.name)).toEqual(["t4", "a100"]);
    expect(merged?.[0].displayName).toBe("NVIDIA");
  });

  it("adds a pinned memory size and interface to a model that is available", () => {
    const merged = withPinnedGpu(AVAILABLE, { vendor: "nvidia", name: "t4", memory: "32Gi", interface: "sxm" });

    expect(merged?.[0].models[0]).toMatchObject({ memory: ["16Gi", "32Gi"], interface: ["pcie", "sxm"] });
  });

  it("keeps the provider count of a pinned model that is available", () => {
    const merged = withPinnedGpu(AVAILABLE, { vendor: "nvidia", name: "t4", memory: "16Gi", interface: "pcie" });

    expect(merged?.[0].models[0].providerCount).toBe(2);
  });

  it("does not duplicate values that are already offered", () => {
    const merged = withPinnedGpu(AVAILABLE, { vendor: "nvidia", name: "t4", memory: "16Gi", interface: "pcie" });

    expect(merged?.[0].models[0]).toMatchObject({ memory: ["16Gi"], interface: ["pcie"] });
    expect(merged?.[0].models).toHaveLength(1);
  });

  it("leaves the list untouched when nothing is pinned", () => {
    expect(withPinnedGpu(AVAILABLE, {})).toBe(AVAILABLE);
  });

  it("adds a pinned vendor with no model when only the vendor is set", () => {
    const merged = withPinnedGpu(AVAILABLE, { vendor: "amd" });

    expect(merged?.[1]).toEqual({ name: "amd", displayName: undefined, models: [] });
  });

  it("reports no list when there is none to merge into", () => {
    expect(withPinnedGpu(undefined, { vendor: "amd", name: "mi300" })).toBeUndefined();
  });
});

describe(listGpuMemoryOptions.name, () => {
  const H100: GpuModel = {
    name: "h100",
    memory: ["80Gi", "94Gi"],
    interface: ["sxm", "pcie"],
    variants: [
      { memory: null, interface: null, providerCount: 3 },
      { memory: "80Gi", interface: null, providerCount: 3 },
      { memory: null, interface: "sxm", providerCount: 3 },
      { memory: "94Gi", interface: "pcie", providerCount: 1 }
    ]
  };

  it("lists the memory sizes a provider advertises with the interface left unpinned", () => {
    expect(listGpuMemoryOptions(H100, {})).toEqual(["80Gi"]);
  });

  it("lists the memory sizes a provider advertises together with the pinned interface", () => {
    expect(listGpuMemoryOptions(H100, { interface: "pcie" })).toEqual(["94Gi"]);
  });

  it("keeps the pinned memory size listed when no provider advertises it with the pinned interface", () => {
    expect(listGpuMemoryOptions(H100, { memory: "80Gi", interface: "sxm" })).toEqual(["80Gi"]);
  });

  it("falls back to the model's memory sizes when it carries no combinations", () => {
    expect(listGpuMemoryOptions({ name: "t4", memory: ["16Gi"], interface: ["pcie"] }, { interface: "pcie" })).toEqual(["16Gi"]);
  });

  it("lists only the pinned memory size while no model is picked", () => {
    expect(listGpuMemoryOptions(undefined, { memory: "80Gi" })).toEqual(["80Gi"]);
  });
});

describe(listGpuInterfaceOptions.name, () => {
  const A100: GpuModel = {
    name: "a100",
    memory: ["40Gi", "80Gi"],
    interface: ["pcie", "sxm"],
    variants: [
      { memory: null, interface: null, providerCount: 2 },
      { memory: null, interface: "pcie", providerCount: 2 },
      { memory: "80Gi", interface: "sxm", providerCount: 1 }
    ]
  };

  it("lists the interfaces a provider advertises with the memory size left unpinned", () => {
    expect(listGpuInterfaceOptions(A100, {})).toEqual(["pcie"]);
  });

  it("lists the interfaces a provider advertises together with the pinned memory size", () => {
    expect(listGpuInterfaceOptions(A100, { memory: "80Gi" })).toEqual(["sxm"]);
  });

  it("keeps the pinned interface listed when no provider advertises it with the pinned memory size", () => {
    expect(listGpuInterfaceOptions(A100, { memory: "40Gi", interface: "pcie" })).toEqual(["pcie"]);
  });

  it("falls back to the model's interfaces when it carries no combinations", () => {
    expect(listGpuInterfaceOptions({ name: "t4", memory: ["16Gi"], interface: ["pcie"] }, { memory: "16Gi" })).toEqual(["pcie"]);
  });

  it("lists only the pinned interface while no model is picked", () => {
    expect(listGpuInterfaceOptions(undefined, { interface: "sxm" })).toEqual(["sxm"]);
  });
});
