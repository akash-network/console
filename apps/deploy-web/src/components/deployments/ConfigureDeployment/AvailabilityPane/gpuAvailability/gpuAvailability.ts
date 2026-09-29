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

export interface GpuAvailabilityRow {
  key: string;
  label: string;
  providerCount: number | null;
  isCurrent: boolean;
  share: number;
}

const MAX_TOP_GPU_MODELS = 5;

const NO_GPU_LABEL = "No GPU";

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
  if (!requested) return NO_GPU_LABEL;
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

type GpuAvailabilityRowsInput = {
  requestedLabel: string;
  requestedCount: number | null;
  hasRequestedGpu: boolean;
  topModels: GpuAvailabilityModel[];
  networkCount: number | null;
};

/** Every bar is a share of the network total, or of the busiest row while that total is unknown, so no bar overflows. */
export function listGpuAvailabilityRows({
  requestedLabel,
  requestedCount,
  hasRequestedGpu,
  topModels,
  networkCount
}: GpuAvailabilityRowsInput): GpuAvailabilityRow[] {
  const noGpuRows = hasRequestedGpu && networkCount !== null ? [{ key: "no-gpu", label: NO_GPU_LABEL, providerCount: networkCount, isCurrent: false }] : [];
  const rows = [
    { key: "current", label: requestedLabel, providerCount: requestedCount, isCurrent: true },
    ...topModels.map(model => ({ key: model.key, label: model.label, providerCount: model.providerCount, isCurrent: false })),
    ...noGpuRows
  ];
  const scale = networkCount ?? Math.max(...rows.map(row => row.providerCount ?? 0));

  return rows.map(row => ({ ...row, share: scale > 0 && row.providerCount ? Math.min(1, row.providerCount / scale) : 0 }));
}

function gpuDisplayName(vendor: string, name: string, catalog: GpuVendor[] | undefined): string {
  const catalogModel = catalog?.find(candidate => candidate.name === vendor)?.models.find(model => model.name === name);
  return catalogModel?.displayName ?? name.toUpperCase();
}
