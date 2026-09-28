import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";

export interface RequestedGpu {
  vendor: string;
  name?: string;
}

export interface GpuAvailabilityModel {
  key: string;
  label: string;
  providerCount: number;
}

const MAX_TOP_GPU_MODELS = 5;

/** The first GPU a placement's services ask for, or null while none asks for a GPU unit. */
export function requestedGpuOf(services: SdlBuilderFormValuesType["services"] | undefined, placementId: string): RequestedGpu | null {
  const gpuService = (services ?? []).find(
    service => service.placementId === placementId && !isLogCollectorService(service) && service.profile.hasGpu && (service.profile.gpu ?? 0) > 0
  );
  if (!gpuService) return null;
  const [model] = gpuService.profile.gpuModels ?? [];
  return model ? { vendor: model.vendor, name: model.name || undefined } : { vendor: "nvidia" };
}

export function requestedGpuLabel(requested: RequestedGpu | null, catalog: GpuVendor[] | undefined): string {
  if (!requested) return "No GPU";
  if (!requested.name) return "Any GPU";
  return gpuDisplayName(requested.vendor, requested.name, catalog);
}

/** The models the most audited providers could serve right now, across the whole network, leaving out the one already requested. */
export function topGpuModels(options: PlacementOptions | undefined, catalog: GpuVendor[] | undefined, requested: RequestedGpu | null): GpuAvailabilityModel[] {
  return (options?.gpus ?? [])
    .flatMap(vendor => vendor.models.map(model => ({ vendor: vendor.vendor, name: model.name, providerCount: model.providerCount })))
    .filter(model => model.providerCount > 0 && !(model.vendor === requested?.vendor && model.name === requested?.name))
    .sort((left, right) => right.providerCount - left.providerCount)
    .slice(0, MAX_TOP_GPU_MODELS)
    .map(model => ({ key: `${model.vendor}/${model.name}`, label: gpuDisplayName(model.vendor, model.name, catalog), providerCount: model.providerCount }));
}

function gpuDisplayName(vendor: string, name: string, catalog: GpuVendor[] | undefined): string {
  const catalogModel = catalog?.find(candidate => candidate.name === vendor)?.models.find(model => model.name === name);
  return catalogModel?.displayName ?? name.toUpperCase();
}
