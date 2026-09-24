import { describe, expect, it } from "vitest";

import type { AvailableGpuVendor } from "@src/queries/usePlacementOptions";
import type { GpuVendor } from "@src/types/gpu";
import { narrowGpuVendorsToAvailable, prioritizeGpuModels, withPinnedGpu } from "./gpu";

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

    expect(narrowed).toEqual([{ name: "nvidia", displayName: "NVIDIA", models: [{ name: "t4", displayName: "T4", memory: ["16Gi"], interface: ["pcie"] }] }]);
  });

  it("keeps only the memory sizes and interfaces the model is available with", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("a100", ["80Gi"], ["sxm"])] }]);

    expect(narrowed?.[0].models[0]).toMatchObject({ memory: ["80Gi"], interface: ["sxm"] });
  });

  it("offers a model the catalog does not list, without a display name", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("b200", ["180Gi"], ["sxm"])] }]);

    expect(narrowed?.[0].models[0]).toEqual({ name: "b200", displayName: undefined, memory: ["180Gi"], interface: ["sxm"] });
  });

  it("falls back to the catalog memory and interface when providers report none", () => {
    const narrowed = narrowGpuVendorsToAvailable(CATALOG, [{ vendor: "nvidia", models: [model("a100", [], [])] }]);

    expect(narrowed?.[0].models[0]).toMatchObject({ memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] });
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

  function model(name: string, memory: string[], gpuInterface: string[]): AvailableGpuVendor["models"][number] {
    return { name, memory, interface: gpuInterface, providerCount: 1 };
  }
});

describe(withPinnedGpu.name, () => {
  const AVAILABLE: GpuVendor[] = [{ name: "nvidia", displayName: "NVIDIA", models: [{ name: "t4", memory: ["16Gi"], interface: ["pcie"] }] }];

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
