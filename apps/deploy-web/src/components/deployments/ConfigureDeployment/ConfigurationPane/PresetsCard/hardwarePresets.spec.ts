import { describe, expect, it } from "vitest";

import { defaultService } from "@src/utils/sdl/data";
import type { DetectableProfile, HardwarePreset } from "./hardwarePresets";
import { applyPresetToProfile, DEFAULT_HARDWARE_PRESET, detectPreset, hardwarePresets } from "./hardwarePresets";

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

describe(applyPresetToProfile.name, () => {
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

  it("applies a compute preset's cpu, memory and root storage without a GPU", () => {
    const result = applyPresetToProfile(defaultService("p").profile, compute);

    expect(result).toMatchObject({ cpu: 4, ram: 16, ramUnit: "Gi", hasGpu: false, gpu: 0, gpuModels: [] });
    expect(result.storage[0]).toMatchObject({ size: 50, unit: "Gi", isPersistent: false });
  });

  it("applies a GPU preset's vendor, model and count", () => {
    const result = applyPresetToProfile(defaultService("p").profile, gpu);

    expect(result).toMatchObject({ cpu: 4, ram: 16, hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "t4" }] });
  });

  it("preserves extra (persistent) storage volumes beyond the root one", () => {
    const base = defaultService("p").profile;
    base.storage.push({ size: 5, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data" });

    const result = applyPresetToProfile(base, compute);

    expect(result.storage).toHaveLength(2);
    expect(result.storage[1]).toMatchObject({ name: "data", isPersistent: true });
  });

  it("round-trips through detectPreset", () => {
    const result = applyPresetToProfile(defaultService("p").profile, DEFAULT_HARDWARE_PRESET);

    expect(detectPreset(hardwarePresets, result)?.id).toBe("small");
  });
});
