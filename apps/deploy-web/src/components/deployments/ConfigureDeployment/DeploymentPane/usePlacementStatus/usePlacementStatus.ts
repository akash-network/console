import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { ConfigStatus } from "../ConfigStatusIcon/ConfigStatusIcon";
import { isServiceConfigured } from "../useServiceStatus/useServiceStatus";

/** Aggregate configuration status of a placement, derived from the form context. */
export const usePlacementStatus = (placementId: string): ConfigStatus => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control });

  return useMemo(() => getPlacementStatus(values as SdlBuilderFormValuesType, placementId), [values, placementId]);
};

/**
 * Aggregates the per-service configuration status for a placement: `complete`
 * when it owns at least one non-log-collector service and all of them pass
 * {@link isServiceConfigured}, `partial` when only some pass, and `incomplete`
 * when none pass (or it has no services). The placement's own name/region are
 * intentionally out of scope — the form resolver surfaces those inline.
 */
export function getPlacementStatus(values: SdlBuilderFormValuesType, placementId: string): ConfigStatus {
  const services = values.services ?? [];
  const indexes = services
    .map((service, index) => ({ service, index }))
    .filter(({ service }) => service.placementId === placementId && !isLogCollectorService(service))
    .map(({ index }) => index);

  if (indexes.length === 0) {
    return "incomplete";
  }

  const completeCount = indexes.filter(index => isServiceConfigured(values, index)).length;

  if (completeCount === 0) {
    return "incomplete";
  }

  return completeCount === indexes.length ? "complete" : "partial";
}
