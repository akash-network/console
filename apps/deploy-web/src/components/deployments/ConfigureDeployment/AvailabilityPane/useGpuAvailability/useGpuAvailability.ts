import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { useGpuModels } from "@src/queries/useGpuQuery";
import { usePlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuAvailabilityModel } from "../gpuAvailability/gpuAvailability";
import { requestedGpuLabel, requestedGpuOf, topGpuModels } from "../gpuAvailability/gpuAvailability";

export const DEPENDENCIES = { usePlacementOptions, useGpuModels };

export interface GpuAvailability {
  requestedLabel: string;
  hasRequestedGpu: boolean;
  topModels: GpuAvailabilityModel[];
}

export function useGpuAvailability(placementId: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): GpuAvailability {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  const { data: placementOptions } = dependencies.usePlacementOptions();
  const { data: catalog } = dependencies.useGpuModels();

  return useMemo(() => {
    const requested = requestedGpuOf(services, placementId);
    return {
      requestedLabel: requestedGpuLabel(requested, catalog),
      hasRequestedGpu: requested !== null,
      topModels: topGpuModels(placementOptions, catalog, requested)
    };
  }, [catalog, placementId, placementOptions, services]);
}
