import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { useGpuModels } from "@src/queries/useGpuQuery";
import { usePlacementOptions } from "@src/queries/usePlacementOptions";
import { SCREENING_DEBOUNCE_MS, SCREENING_MAX_WAIT_MS, useScreenedProviderCounts } from "@src/queries/useScreenedProviders";
import type { PlacementType, SdlBuilderFormValuesType } from "@src/types";
import type { GpuAvailabilityModel } from "../gpuAvailability/gpuAvailability";
import { candidateGpuModels, rankGpuAlternatives, requestedGpuLabel, requestedGpuOf } from "../gpuAvailability/gpuAvailability";
import { screeningRequestOf, withGpuModel, withoutGpu } from "../gpuVariants/gpuVariants";

export const DEPENDENCIES = { usePlacementOptions, useGpuModels, useScreenedProviderCounts };

const NO_GPU_KEY = "no-gpu";

export interface GpuAvailability {
  requestedLabel: string;
  /** False while no service of the placement asks for a GPU, so the current request has no GPUs to count. */
  requestsGpu: boolean;
  alternatives: GpuAvailabilityModel[];
  noGpuCount: number | null;
  isChecking: boolean;
  noOtherModelFits: boolean;
}

export function useGpuAvailability(
  placement: Pick<PlacementType, "id" | "name" | "regions">,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): GpuAvailability {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control }) as SdlBuilderFormValuesType;
  const pacedValues = usePacedValue(values, { wait: SCREENING_DEBOUNCE_MS, maxWait: SCREENING_MAX_WAIT_MS });
  const { data: placementOptions } = dependencies.usePlacementOptions();
  const { data: catalog } = dependencies.useGpuModels();

  const requested = useMemo(() => requestedGpuOf(pacedValues.services, placement.id), [pacedValues.services, placement.id]);
  const candidates = useMemo(() => candidateGpuModels(placementOptions, requested), [placementOptions, requested]);
  const requests = useMemo(() => {
    const modelRequests = candidates.map(model => ({
      key: model.key,
      request: screeningRequestOf(withGpuModel(pacedValues, placement.id, model), placement.name),
      regions: placement.regions
    }));
    return requested
      ? [...modelRequests, { key: NO_GPU_KEY, request: screeningRequestOf(withoutGpu(pacedValues, placement.id), placement.name), regions: placement.regions }]
      : modelRequests;
  }, [candidates, pacedValues, placement.id, placement.name, placement.regions, requested]);
  const counts = dependencies.useScreenedProviderCounts(requests);

  const alternatives = rankGpuAlternatives(candidates, counts, catalog);
  const isChecking = counts.some(count => count.isLoading);

  return {
    requestedLabel: requestedGpuLabel(requested, catalog),
    requestsGpu: requested !== null,
    alternatives,
    noGpuCount: requested ? counts[candidates.length].count : null,
    isChecking,
    noOtherModelFits: candidates.length > 0 && !isChecking && alternatives.length === 0
  };
}
