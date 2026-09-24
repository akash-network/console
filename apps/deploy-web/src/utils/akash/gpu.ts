import type { AvailableGpuVendor } from "@src/queries/usePlacementOptions";
import type { GpuModel, GpuVendor } from "@src/types/gpu";

export const gpuVendors = [{ id: 1, value: "nvidia", label: "NVIDIA" }];

/** An absent or empty availability answer returns the catalog untouched, so a failed fetch leaves the card offering everything rather than nothing. */
export function narrowGpuVendorsToAvailable(catalog: GpuVendor[] | undefined, available: AvailableGpuVendor[] | undefined): GpuVendor[] | undefined {
  if (!available?.length) return catalog;

  return available.map(availableVendor => {
    const catalogVendor = catalog?.find(vendor => vendor.name === availableVendor.vendor);

    return {
      name: availableVendor.vendor,
      displayName: catalogVendor?.displayName,
      models: availableVendor.models.map(availableModel => {
        const catalogModel = catalogVendor?.models.find(model => model.name === availableModel.name);

        return {
          name: availableModel.name,
          displayName: catalogModel?.displayName,
          memory: availableModel.memory.length ? availableModel.memory : catalogModel?.memory ?? [],
          interface: availableModel.interface.length ? availableModel.interface : catalogModel?.interface ?? [],
          providerCount: availableModel.providerCount
        };
      })
    };
  });
}

export interface PinnedGpu {
  vendor?: string | null;
  name?: string | null;
  memory?: string | null;
  interface?: string | null;
}

/** Without this a configuration pinning a vendor or model no provider offers any more would render a blank trigger and an empty, disabled picker. */
export function withPinnedGpu(vendors: GpuVendor[] | undefined, pinned: PinnedGpu): GpuVendor[] | undefined {
  if (!vendors || !pinned.vendor) return vendors;

  const index = vendors.findIndex(vendor => vendor.name === pinned.vendor);
  const existing = index === -1 ? undefined : vendors[index];
  const entry: GpuVendor = { name: pinned.vendor, displayName: existing?.displayName, models: withPinnedModel(existing?.models ?? [], pinned) };

  const merged = [...vendors];
  if (index === -1) merged.push(entry);
  else merged[index] = entry;

  return merged;
}

function withPinnedModel(models: GpuModel[], pinned: PinnedGpu): GpuModel[] {
  if (!pinned.name) return models;

  const index = models.findIndex(model => model.name === pinned.name);
  const existing = index === -1 ? undefined : models[index];
  const entry: GpuModel = {
    ...existing,
    name: pinned.name,
    memory: withPinnedValue(existing?.memory ?? [], pinned.memory),
    interface: withPinnedValue(existing?.interface ?? [], pinned.interface)
  };

  const merged = [...models];
  if (index === -1) merged.push(entry);
  else merged[index] = entry;

  return merged;
}

function withPinnedValue(values: string[], pinned: string | null | undefined): string[] {
  if (!pinned || values.includes(pinned)) return values;
  return [...values, pinned];
}

/** Empty while availability is absent or empty, so a failed fetch keeps every model selectable. */
export function findUnavailableGpuModels(catalog: GpuVendor[] | undefined, available: AvailableGpuVendor[] | undefined, pinned: PinnedGpu): GpuModel[] {
  if (!available?.length || !pinned.vendor) return [];

  const offeredNames = new Set(available.find(vendor => vendor.vendor === pinned.vendor)?.models.map(model => model.name));
  const catalogModels = catalog?.find(vendor => vendor.name === pinned.vendor)?.models ?? [];
  const unavailable = catalogModels.filter(model => !offeredNames.has(model.name));

  const pinnedName = pinned.name;
  if (pinnedName && !offeredNames.has(pinnedName) && !catalogModels.some(model => model.name === pinnedName)) {
    return [{ name: pinnedName, memory: [], interface: [] }, ...unavailable];
  }

  return unavailable;
}

/** GPU model-name prefixes (normalized, lowercase) floated to the top of the model picker, most popular first (by network capacity and usage). Prefix-matched, so `pro6000` covers `pro6000se`/`we`/`mq`, `h200` covers `h200nvl`, `rtx5090` covers `rtx5090m`, etc. */
export const PRIORITIZED_GPU_MODELS = ["h100", "a100", "h200", "pro6000", "rtx5090", "rtx4090", "rtx3090"];

/** Stable-sorts models so any whose normalized name starts with an earlier {@link PRIORITIZED_GPU_MODELS} entry rises first; unmatched models keep their original order. */
export function prioritizeGpuModels<T extends { name: string }>(models: T[], priority: readonly string[] = PRIORITIZED_GPU_MODELS): T[] {
  return models
    .map((model, index) => ({ model, index, rank: priorityRank(model.name, priority) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(entry => entry.model);
}

/** Index of the first priority prefix the normalized name starts with, or `Infinity` when none match. */
function priorityRank(name: string, priority: readonly string[]): number {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const rank = priority.findIndex(prefix => normalized.startsWith(prefix));
  return rank === -1 ? Infinity : rank;
}
