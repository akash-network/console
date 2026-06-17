import type { UseFormSetValue } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";

/**
 * Predefined hardware profiles offered in the Configuration pane's "Presets"
 * card. Picking a preset overwrites the selected service's compute values
 * (CPU, memory, ephemeral storage, and optionally GPU). The values map directly
 * to the `profile.*` fields of the SDL builder model, so units use the same
 * suffixes as {@link memoryUnits} / {@link storageUnits}.
 *
 * Presets are split into {@link HardwarePresetGroup}s ("Compute" and "GPU") that
 * render as labelled sections in the dropdown.
 */
export type HardwarePresetGroup = "compute" | "gpu";

export interface HardwarePreset {
  id: string;
  /** Display name shown on the left of the option (e.g. "small", "H100"). */
  label: string;
  group: HardwarePresetGroup;
  cpu: number;
  ram: number;
  ramUnit: string;
  storage: number;
  storageUnit: string;
  /** GPU units; `0` (or omitted) means the preset has no GPU. */
  gpu?: number;
  /** GPU vendor applied to `profile.gpuModels[0]` when `gpu` > 0. */
  gpuVendor?: string;
  /** GPU model name applied to `profile.gpuModels[0]` when `gpu` > 0. */
  gpuModel?: string;
}

export const hardwarePresets: HardwarePreset[] = [
  { id: "small", label: "small", group: "compute", cpu: 1, ram: 2, ramUnit: "Gi", storage: 10, storageUnit: "Gi" },
  { id: "medium", label: "medium", group: "compute", cpu: 4, ram: 16, ramUnit: "Gi", storage: 50, storageUnit: "Gi" },
  { id: "large", label: "large", group: "compute", cpu: 16, ram: 64, ramUnit: "Gi", storage: 200, storageUnit: "Gi" },
  { id: "gpu-t4", label: "T4", group: "gpu", cpu: 4, ram: 16, ramUnit: "Gi", storage: 100, storageUnit: "Gi", gpu: 1, gpuVendor: "nvidia", gpuModel: "t4" },
  {
    id: "gpu-a100",
    label: "A100",
    group: "gpu",
    cpu: 8,
    ram: 64,
    ramUnit: "Gi",
    storage: 200,
    storageUnit: "Gi",
    gpu: 1,
    gpuVendor: "nvidia",
    gpuModel: "a100"
  },
  {
    id: "gpu-h100",
    label: "H100",
    group: "gpu",
    cpu: 16,
    ram: 128,
    ramUnit: "Gi",
    storage: 400,
    storageUnit: "Gi",
    gpu: 1,
    gpuVendor: "nvidia",
    gpuModel: "h100"
  }
];

/** Section headings shown above each group in the dropdown. */
export const HARDWARE_PRESET_GROUP_LABELS: Record<HardwarePresetGroup, string> = {
  compute: "Compute",
  gpu: "GPU"
};

/** The order groups appear in the dropdown. */
export const HARDWARE_PRESET_GROUP_ORDER: HardwarePresetGroup[] = ["compute", "gpu"];

/**
 * Builds the right-aligned spec summary for a preset, e.g. "1 vCPU · 2 GiB" or
 * "1× T4" appended for GPU presets.
 */
export function formatPresetSpecs(preset: HardwarePreset): string {
  const parts = [`${preset.cpu} vCPU`, `${preset.ram} ${preset.ramUnit === "Gi" ? "GiB" : preset.ramUnit}`];
  if (preset.gpu && preset.gpu > 0 && preset.gpuModel) {
    parts.push(`${preset.gpu}× ${preset.gpuModel.toUpperCase()}`);
  }
  return parts.join(" · ");
}

/** The compute/GPU fields of a service profile that {@link detectPreset} compares against a preset. */
export type DetectableProfile = {
  cpu?: number | null;
  ram?: number | null;
  ramUnit?: string;
  storage?: Array<{ size?: number | null; unit?: string }>;
  hasGpu?: boolean;
  gpu?: number;
  gpuModels?: Array<{ vendor?: string; name?: string }> | null;
};

/**
 * Returns the preset whose values equal the service's current compute resources,
 * or `undefined` when they match none (a custom configuration). This is the
 * inverse of applying a preset, so the Presets select can reflect the active
 * preset instead of always resetting to its placeholder after each pick.
 */
export function detectPreset(presets: HardwarePreset[], profile: DetectableProfile): HardwarePreset | undefined {
  return presets.find(preset => presetMatchesProfile(preset, profile));
}

/** Whether the profile's compute (and GPU, when the preset defines one) equals the preset's values. */
function presetMatchesProfile(preset: HardwarePreset, profile: DetectableProfile): boolean {
  const root = profile.storage?.[0];
  const computeMatches =
    profile.cpu === preset.cpu &&
    profile.ram === preset.ram &&
    profile.ramUnit === preset.ramUnit &&
    root?.size === preset.storage &&
    root?.unit === preset.storageUnit;

  if (!computeMatches) {
    return false;
  }

  if (!preset.gpu) {
    return !profile.hasGpu;
  }

  const model = profile.gpuModels?.[0];
  return !!profile.hasGpu && profile.gpu === preset.gpu && model?.vendor === (preset.gpuVendor ?? "nvidia") && model?.name === (preset.gpuModel ?? "");
}

/** Overwrites the service's compute profile with the preset's values — the inverse of {@link detectPreset}. */
export function applyPreset(setValue: UseFormSetValue<SdlBuilderFormValuesType>, serviceIndex: number, preset: HardwarePreset) {
  const options = { shouldValidate: true, shouldDirty: true } as const;

  setValue(`services.${serviceIndex}.profile.cpu`, preset.cpu, options);
  setValue(`services.${serviceIndex}.profile.ram`, preset.ram, options);
  setValue(`services.${serviceIndex}.profile.ramUnit`, preset.ramUnit, options);
  setValue(`services.${serviceIndex}.profile.storage.0.size`, preset.storage, options);
  setValue(`services.${serviceIndex}.profile.storage.0.unit`, preset.storageUnit, options);

  const gpu = preset.gpu ?? 0;
  setValue(`services.${serviceIndex}.profile.gpu`, gpu, options);
  setValue(`services.${serviceIndex}.profile.hasGpu`, gpu > 0, options);

  if (gpu > 0) {
    setValue(`services.${serviceIndex}.profile.gpuModels`, [{ vendor: preset.gpuVendor ?? "nvidia", name: preset.gpuModel ?? "" }], options);
  } else {
    setValue(`services.${serviceIndex}.profile.gpuModels`, [], options);
  }
}
