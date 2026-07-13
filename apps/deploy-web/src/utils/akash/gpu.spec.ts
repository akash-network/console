import { describe, expect, it } from "vitest";

import { prioritizeGpuModels } from "./gpu";

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
