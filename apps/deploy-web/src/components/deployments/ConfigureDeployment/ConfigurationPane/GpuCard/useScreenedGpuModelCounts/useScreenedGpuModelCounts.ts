import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ScreenedProviderCount } from "@src/queries/useScreenedProviders";
import { useScreenedProviderCounts } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { screeningRequestOf, withServiceGpuModel } from "../../../AvailabilityPane/gpuVariants/gpuVariants";

export const DEPENDENCIES = { useScreenedProviderCounts };

export type ScreenedGpuModel = { vendor: string; name: string };

/** Builds the requests the availability pane sends for the same switches, so the picker and the pane read one cached screening per model. */
export function useScreenedGpuModelCounts(
  serviceIndex: number,
  models: readonly ScreenedGpuModel[],
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): ScreenedProviderCount[] {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control }) as SdlBuilderFormValuesType;
  const placement = values.placements.find(candidate => candidate.id === values.services[serviceIndex]?.placementId);
  const requests = useMemo(
    () =>
      models.map(({ vendor, name }) => ({
        key: `${vendor}/${name}`,
        request: placement ? screeningRequestOf(withServiceGpuModel(values, serviceIndex, { vendor, name }), placement.name) : null,
        regions: placement?.regions
      })),
    [models, placement, values, serviceIndex]
  );

  return dependencies.useScreenedProviderCounts(requests);
}
