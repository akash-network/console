import { useCallback, useMemo } from "react";
import type { UseFormSetValue } from "react-hook-form";

import { AUDITOR_OPTIONS, REGION_OPTIONS } from "@src/components/new-deployment/ConfigureProviders/PlacementSection";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";

export type ActiveFilter = {
  key: string;
  label: string;
};

type UseActiveFiltersInput = {
  services: ServiceType[];
  placementFilters: PlacementFilters;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  onPlacementChange: (filters: PlacementFilters) => void;
};

const DEFAULT_MAX_PRICE = 0.1;

export function useActiveFilters({ services, placementFilters, setValue, onPlacementChange }: UseActiveFiltersInput) {
  const filters = useMemo<ActiveFilter[]>(() => {
    const result: ActiveFilter[] = [];

    const gpuService = services.find(s => s.profile.hasGpu);
    if (gpuService) {
      const gpuModel = gpuService.profile.gpuModels?.[0];
      if (gpuModel?.name) {
        result.push({ key: "gpu-model", label: `GPU: ${gpuModel.name.toUpperCase()}` });
      }

      const totalGpuCount = services.reduce((sum, s) => sum + (s.profile.hasGpu ? s.profile.gpu ?? 1 : 0), 0);
      if (totalGpuCount > 1) {
        result.push({ key: "gpu-count", label: `${totalGpuCount}× GPU` });
      }
    }

    for (const address of placementFilters.auditedBy) {
      const option = AUDITOR_OPTIONS.find(o => o.address === address);
      result.push({ key: `auditor:${address}`, label: `Audited: ${option?.label ?? address.slice(0, 10)}` });
    }

    for (const key of placementFilters.regions) {
      const option = REGION_OPTIONS.find(o => o.key === key);
      result.push({ key: `region:${key}`, label: `Region: ${option?.label ?? key}` });
    }

    if (placementFilters.maxPrice !== null && placementFilters.maxPrice !== DEFAULT_MAX_PRICE) {
      result.push({ key: "max-price", label: `Price: ≤${placementFilters.maxPrice} ACT` });
    }

    return result;
  }, [services, placementFilters]);

  const clearGpuAcrossServices = useCallback(() => {
    services.forEach((_, i) => {
      setValue(`services.${i}.profile.gpuModels`, [{ vendor: "nvidia", name: "", memory: "", interface: "" }]);
    });
  }, [services, setValue]);

  const resetGpuCountAcrossServices = useCallback(() => {
    services.forEach((_, i) => {
      setValue(`services.${i}.profile.gpu`, 1);
    });
  }, [services, setValue]);

  const handleDismiss = useCallback(
    (filterKey: string) => {
      if (filterKey === "gpu-model") {
        clearGpuAcrossServices();
      } else if (filterKey === "gpu-count") {
        resetGpuCountAcrossServices();
      } else if (filterKey.startsWith("auditor:")) {
        const address = filterKey.slice("auditor:".length);
        onPlacementChange({ ...placementFilters, auditedBy: placementFilters.auditedBy.filter(a => a !== address) });
      } else if (filterKey.startsWith("region:")) {
        const key = filterKey.slice("region:".length);
        onPlacementChange({ ...placementFilters, regions: placementFilters.regions.filter(r => r !== key) });
      } else if (filterKey === "max-price") {
        onPlacementChange({ ...placementFilters, maxPrice: DEFAULT_MAX_PRICE });
      }
    },
    [placementFilters, onPlacementChange, clearGpuAcrossServices, resetGpuCountAcrossServices]
  );

  const handleClearAll = useCallback(() => {
    const anyHasGpuModel = services.some(s => s.profile.hasGpu && s.profile.gpuModels?.[0]?.name);
    const anyHasGpuCount = services.some(s => s.profile.hasGpu && (s.profile.gpu ?? 1) > 1);

    if (anyHasGpuModel) clearGpuAcrossServices();
    if (anyHasGpuCount) resetGpuCountAcrossServices();
    onPlacementChange({ maxPrice: DEFAULT_MAX_PRICE, auditedBy: [], regions: [] });
  }, [services, clearGpuAcrossServices, resetGpuCountAcrossServices, onPlacementChange]);

  return { filters, handleDismiss, handleClearAll };
}
