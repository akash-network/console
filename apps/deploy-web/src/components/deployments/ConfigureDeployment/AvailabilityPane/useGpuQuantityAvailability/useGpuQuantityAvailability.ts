import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { SCREENING_DEBOUNCE_MS, SCREENING_MAX_WAIT_MS, useScreenedProviderCounts } from "@src/queries/useScreenedProviders";
import type { PlacementType, SdlBuilderFormValuesType } from "@src/types";
import { isPlacementGpuService } from "../gpuAvailability/gpuAvailability";
import { screeningRequestOf, withGpuCount } from "../gpuVariants/gpuVariants";

export const DEPENDENCIES = { useScreenedProviderCounts };

const GPU_QUANTITIES = [1, 2, 4, 8];

export interface GpuQuantityAvailability {
  gpuCount: number;
  providerCount: number | null;
  isCurrent: boolean;
}

/** Empty while no service of the placement asks for a GPU, because there is no GPU to count at other quantities. */
export function useGpuQuantityAvailability(
  placement: Pick<PlacementType, "id" | "name" | "regions">,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): GpuQuantityAvailability[] {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control }) as SdlBuilderFormValuesType;
  const pacedValues = usePacedValue(values, { wait: SCREENING_DEBOUNCE_MS, maxWait: SCREENING_MAX_WAIT_MS });
  const currentGpuCount = pacedValues.services.find(service => isPlacementGpuService(service, placement.id))?.profile.gpu;
  const requests = useMemo(
    () =>
      currentGpuCount === undefined
        ? []
        : GPU_QUANTITIES.map(gpuCount => ({
            key: `${gpuCount}`,
            request: screeningRequestOf(withGpuCount(pacedValues, placement.id, gpuCount), placement.name),
            regions: placement.regions
          })),
    [currentGpuCount, pacedValues, placement.id, placement.name, placement.regions]
  );
  const counts = dependencies.useScreenedProviderCounts(requests);

  return counts.map((count, index) => ({ gpuCount: GPU_QUANTITIES[index], providerCount: count.count, isCurrent: GPU_QUANTITIES[index] === currentGpuCount }));
}
