import { describe, expect, it } from "vitest";

import type { DetectableProfile, HardwarePreset } from "./hardwarePresets";
import { detectPreset } from "./hardwarePresets";

describe(detectPreset.name, () => {
  const compute: HardwarePreset = { id: "medium", label: "medium", group: "compute", cpu: 4, ram: 16, ramUnit: "Gi", storage: 50, storageUnit: "Gi" };
  const gpu: HardwarePreset = {
    id: "gpu-t4",
    label: "T4",
    group: "gpu",
    cpu: 4,
    ram: 16,
    ramUnit: "Gi",
    storage: 100,
    storageUnit: "Gi",
    gpu: 1,
    gpuVendor: "nvidia",
    gpuModel: "t4"
  };
  const presets = [compute, gpu];

  it("detects a compute preset when cpu, memory and ephemeral storage match", () => {
    const profile: DetectableProfile = { cpu: 4, ram: 16, ramUnit: "Gi", storage: [{ size: 50, unit: "Gi" }], hasGpu: false };

    expect(detectPreset(presets, profile)?.id).toBe("medium");
  });

  it("returns undefined when a compute value diverges from every preset", () => {
    const profile: DetectableProfile = { cpu: 9, ram: 16, ramUnit: "Gi", storage: [{ size: 50, unit: "Gi" }], hasGpu: false };

    expect(detectPreset(presets, profile)).toBeUndefined();
  });

  it("does not match a compute preset when the GPU is enabled", () => {
    const profile: DetectableProfile = { cpu: 4, ram: 16, ramUnit: "Gi", storage: [{ size: 50, unit: "Gi" }], hasGpu: true, gpu: 1 };

    expect(detectPreset(presets, profile)).toBeUndefined();
  });

  it("detects a GPU preset when the vendor, model and count also match", () => {
    const profile: DetectableProfile = {
      cpu: 4,
      ram: 16,
      ramUnit: "Gi",
      storage: [{ size: 100, unit: "Gi" }],
      hasGpu: true,
      gpu: 1,
      gpuModels: [{ vendor: "nvidia", name: "t4" }]
    };

    expect(detectPreset(presets, profile)?.id).toBe("gpu-t4");
  });

  it("does not match a GPU preset when the model differs", () => {
    const profile: DetectableProfile = {
      cpu: 4,
      ram: 16,
      ramUnit: "Gi",
      storage: [{ size: 100, unit: "Gi" }],
      hasGpu: true,
      gpu: 1,
      gpuModels: [{ vendor: "nvidia", name: "a100" }]
    };

    expect(detectPreset(presets, profile)).toBeUndefined();
  });
});
