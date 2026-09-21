import type { AvailableGpuVendor } from "@src/queries/usePlacementOptions";
import type { GpuVendor } from "@src/types/gpu";

export const gpuVendors = [{ id: 1, value: "nvidia", label: "NVIDIA" }];

/**
 * Rebuilds the vendor/model catalog from what online providers currently offer, keeping the catalog's
 * display names where it knows the vendor or model. Driving off availability rather than intersecting
 * means a GPU somebody runs is offered even when the hardware catalog has never heard of it; the catalog
 * still supplies memory sizes and interfaces for a model whose providers report none.
 *
 * An absent or empty availability answer returns the catalog untouched, so a failed fetch leaves the card
 * offering everything rather than nothing.
 */
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
          interface: availableModel.interface.length ? availableModel.interface : catalogModel?.interface ?? []
        };
      })
    };
  });
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
