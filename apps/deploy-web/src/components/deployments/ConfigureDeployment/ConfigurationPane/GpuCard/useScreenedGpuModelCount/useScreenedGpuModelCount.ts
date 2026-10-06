import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { ScreenedProviderCount } from "@src/queries/useScreenedProviders";
import { useScreenedProviderCounts } from "@src/queries/useScreenedProviders";
import type { SdlBuilderFormValuesType } from "@src/types";
import { screeningRequestOf, withServiceGpuModel } from "../../../AvailabilityPane/gpuVariants/gpuVariants";

export const DEPENDENCIES = { useScreenedProviderCounts };

/** Builds the request the availability pane sends for the same switch, so the picker and the pane read one cached screening. */
export function useScreenedGpuModelCount(
  serviceIndex: number,
  model: { vendor: string; name: string },
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): ScreenedProviderCount {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control }) as SdlBuilderFormValuesType;
  const placement = values.placements.find(candidate => candidate.id === values.services[serviceIndex]?.placementId);
  const { vendor, name } = model;
  const request = useMemo(
    () => (placement ? screeningRequestOf(withServiceGpuModel(values, serviceIndex, { vendor, name }), placement.name) : null),
    [placement, values, serviceIndex, vendor, name]
  );
  const [count] = dependencies.useScreenedProviderCounts([{ key: `${vendor}/${name}`, request, regions: placement?.regions }]);

  return count;
}
