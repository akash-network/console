import { describe, expect, it } from "vitest";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { hasTrialBlockedGpu, isTrialBlockedGpuModel, isTrialBlockedGpuSelection, isTrialGpuRestrictionActive } from "./v1beta3";

describe(isTrialBlockedGpuModel.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/a100"];

  it("blocks a listed vendor/model case-insensitively", () => {
    expect(isTrialBlockedGpuModel("nvidia", "h100", BLOCKED)).toBe(true);
    expect(isTrialBlockedGpuModel("NVIDIA", "H100", BLOCKED)).toBe(true);
  });

  it("allows a model that is not on the blocked list", () => {
    expect(isTrialBlockedGpuModel("nvidia", "t4", BLOCKED)).toBe(false);
  });

  it("never blocks when the vendor or model is missing", () => {
    expect(isTrialBlockedGpuModel(undefined, "h100", BLOCKED)).toBe(false);
    expect(isTrialBlockedGpuModel("nvidia", "", BLOCKED)).toBe(false);
  });

  it("never blocks when the blocked list is empty", () => {
    expect(isTrialBlockedGpuModel("nvidia", "h100", [])).toBe(false);
  });
});

describe(isTrialBlockedGpuSelection.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/a100"];

  it("blocks an empty model when the vendor exposes any blocked model", () => {
    expect(isTrialBlockedGpuSelection("nvidia", "", BLOCKED)).toBe(true);
    expect(isTrialBlockedGpuSelection("NVIDIA", undefined, BLOCKED)).toBe(true);
  });

  it("allows an empty model when the vendor exposes no blocked model", () => {
    expect(isTrialBlockedGpuSelection("amd", "", BLOCKED)).toBe(false);
  });

  it("does not treat a prefix-colliding vendor as blocked", () => {
    expect(isTrialBlockedGpuSelection("nvidiax", "", BLOCKED)).toBe(false);
  });

  it("defers a specific model to isTrialBlockedGpuModel", () => {
    expect(isTrialBlockedGpuSelection("nvidia", "h100", BLOCKED)).toBe(true);
    expect(isTrialBlockedGpuSelection("nvidia", "t4", BLOCKED)).toBe(false);
  });

  it("never blocks when the vendor is missing", () => {
    expect(isTrialBlockedGpuSelection(undefined, "", BLOCKED)).toBe(false);
    expect(isTrialBlockedGpuSelection(null, "h100", BLOCKED)).toBe(false);
  });

  it("never blocks when the blocked list is empty", () => {
    expect(isTrialBlockedGpuSelection("nvidia", "", [])).toBe(false);
    expect(isTrialBlockedGpuSelection("nvidia", "h100", [])).toBe(false);
  });
});

describe(isTrialGpuRestrictionActive.name, () => {
  it("is active when any model is blocklisted", () => {
    expect(isTrialGpuRestrictionActive(["nvidia/h100"])).toBe(true);
  });

  it("is inactive when the blocklist is empty", () => {
    expect(isTrialGpuRestrictionActive([])).toBe(false);
  });
});

describe(hasTrialBlockedGpu.name, () => {
  const BLOCKED = ["nvidia/h100", "nvidia/a100"];

  it("flags a GPU-enabled service left on the empty (any) model", () => {
    const values = buildValues([{ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(true);
  });

  it("flags a GPU-enabled service on a specific blocked model", () => {
    const values = buildValues([{ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "h100" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(true);
  });

  it("does not flag a GPU-enabled service on a specific allowed model", () => {
    const values = buildValues([{ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "t4" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(false);
  });

  it("ignores services with GPU turned off even if the model is blocked", () => {
    const values = buildValues([{ hasGpu: false, gpuModels: [{ vendor: "nvidia", name: "" }] }]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(false);
  });

  it("flags when any one of multiple services has a blocked GPU selection", () => {
    const values = buildValues([
      { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "t4" }] },
      { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] }
    ]);

    expect(hasTrialBlockedGpu(values, BLOCKED)).toBe(true);
  });

  function buildValues(services: Array<{ hasGpu: boolean; gpuModels: Array<{ vendor: string; name?: string }> }>): SdlBuilderFormValuesType {
    const base = defaultServiceWithPlacement();
    const placementId = base.placements[0].id;
    return {
      ...base,
      services: services.map((service, index) =>
        defaultService(placementId, {
          title: `service-${index + 1}`,
          profile: { ...base.services[0].profile, hasGpu: service.hasGpu, gpuModels: service.gpuModels }
        })
      )
    };
  }
});
