import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { ScreenedProviderCount } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";

type Service = SdlBuilderFormValuesType["services"][number];

export interface RequestedGpu {
  vendor: string;
  name?: string;
}

export interface GpuModelCandidate {
  key: string;
  vendor: string;
  name: string;
}

export interface GpuAvailabilityModel {
  key: string;
  label: string;
  providerCount: number;
  gpuCount: number | null;
}

export interface GpuAvailabilityRow {
  key: string;
  label: string;
  providerCount: number | null;
  gpuCount: number | null;
  isCurrent: boolean;
  share: number;
}

const MAX_TOP_GPU_MODELS = 5;

const NO_GPU_LABEL = "No GPU";

export function isPlacementGpuService(service: Service, placementId: string): boolean {
  return service.placementId === placementId && !isLogCollectorService(service) && service.profile.hasGpu === true && (service.profile.gpu ?? 0) > 0;
}

/** The first GPU a placement's services ask for, or null while none asks for a GPU unit. */
export function requestedGpuOf(services: SdlBuilderFormValuesType["services"] | undefined, placementId: string): RequestedGpu | null {
  const gpuService = (services ?? []).find(service => isPlacementGpuService(service, placementId));
  if (!gpuService) return null;
  const [model] = gpuService.profile.gpuModels ?? [];
  return model ? { vendor: model.vendor, name: model.name || undefined } : { vendor: "nvidia" };
}

export function requestedGpuLabel(requested: RequestedGpu | null, catalog: GpuVendor[] | undefined): string {
  if (!requested) return NO_GPU_LABEL;
  if (!requested.name) return "Any GPU";
  return gpuDisplayName(requested.vendor, requested.name, catalog);
}

/** Sorted by key so each model keeps its query slot, and with it its placeholder data, across edits. */
export function candidateGpuModels(options: PlacementOptions | undefined, requested: RequestedGpu | null): GpuModelCandidate[] {
  return (options?.gpus ?? [])
    .flatMap(vendor =>
      vendor.models.filter(model => model.providerCount > 0).map(model => ({ key: `${vendor.vendor}/${model.name}`, vendor: vendor.vendor, name: model.name }))
    )
    .filter(model => !(model.vendor === requested?.vendor && model.name === requested?.name))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function rankGpuAlternatives(
  candidates: GpuModelCandidate[],
  counts: ScreenedProviderCount[],
  catalog: GpuVendor[] | undefined
): GpuAvailabilityModel[] {
  return candidates
    .map((candidate, index) => ({
      key: candidate.key,
      label: gpuDisplayName(candidate.vendor, candidate.name, catalog),
      providerCount: counts[index]?.count ?? 0,
      gpuCount: counts[index]?.gpuCount ?? null
    }))
    .filter(model => model.providerCount > 0)
    .sort((left, right) => right.providerCount - left.providerCount || left.label.localeCompare(right.label))
    .slice(0, MAX_TOP_GPU_MODELS);
}

type GpuAvailabilityRowsInput = {
  requestedLabel: string;
  requestedCount: number | null;
  requestedGpuCount: number | null;
  alternatives: GpuAvailabilityModel[];
  noGpuCount: number | null;
  networkCount: number | null;
};

/** Every bar is a share of the network total, or of the busiest row while that total is unknown, so no bar overflows. */
export function listGpuAvailabilityRows({
  requestedLabel,
  requestedCount,
  requestedGpuCount,
  alternatives,
  noGpuCount,
  networkCount
}: GpuAvailabilityRowsInput): GpuAvailabilityRow[] {
  const noGpuRows = noGpuCount ? [{ key: "no-gpu", label: NO_GPU_LABEL, providerCount: noGpuCount, gpuCount: null, isCurrent: false }] : [];
  const rows = [
    { key: "current", label: requestedLabel, providerCount: requestedCount, gpuCount: requestedGpuCount, isCurrent: true },
    ...alternatives.map(model => ({ ...model, isCurrent: false })),
    ...noGpuRows
  ];
  const scale = networkCount ?? Math.max(...rows.map(row => row.providerCount ?? 0));

  return rows.map(row => ({ ...row, share: scale > 0 ? Math.min(1, (row.providerCount ?? 0) / scale) : 0 }));
}

function gpuDisplayName(vendor: string, name: string, catalog: GpuVendor[] | undefined): string {
  const catalogModel = catalog?.find(candidate => candidate.name === vendor)?.models.find(model => model.name === name);
  return catalogModel?.displayName ?? name.toUpperCase();
}
