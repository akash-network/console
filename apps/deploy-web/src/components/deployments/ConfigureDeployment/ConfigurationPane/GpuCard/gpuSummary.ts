import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";

type GpuProfile = Pick<SdlBuilderFormValuesType["services"][number]["profile"], "hasGpu" | "gpu" | "gpuModels">;

const ANY_GPU_LABEL = "Any GPU";

/** The GPU card's header summary: "None" without units, otherwise the count and the accepted models, e.g. `2× H100`. */
export function summarizeGpu(profile: GpuProfile, catalog: GpuVendor[] | undefined): string {
  const count = profile.hasGpu ? profile.gpu ?? 0 : 0;
  if (count <= 0) {
    return "None";
  }

  return `${count}× ${describeAcceptedModels(profile.gpuModels ?? [], catalog)}`;
}

function describeAcceptedModels(models: NonNullable<GpuProfile["gpuModels"]>, catalog: GpuVendor[] | undefined): string {
  const labels = acceptedGpuModelLabels(models, catalog);
  return labels.length > 0 ? labels.join(" / ") : ANY_GPU_LABEL;
}

/** The distinct display names of the accepted models, or none when the profile accepts any model. */
export function acceptedGpuModelLabels(models: NonNullable<GpuProfile["gpuModels"]>, catalog: GpuVendor[] | undefined): string[] {
  if (models.length === 0 || models.some(model => !model.name)) {
    return [];
  }

  return [...new Set(models.map(model => displayNameOf(model.vendor, model.name as string, catalog)))];
}

function displayNameOf(vendor: string, name: string, catalog: GpuVendor[] | undefined): string {
  const catalogModel = catalog?.find(candidate => candidate.name === vendor)?.models.find(model => model.name === name);
  return catalogModel?.displayName ?? name.toUpperCase();
}
