import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { aggregateDeploymentResources, formatDeploymentResources } from "./deploymentResources";

/** Returns the live "Your deployment" resource summary string derived from the current form spec. */
export function useDeploymentResourceSummary(): string {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  return useMemo(() => formatDeploymentResources(aggregateDeploymentResources(services ?? [])), [services]);
}

/**
 * True when the current spec requests any GPU. Drives GPU-vs-CPU-only presentation choices — notably the
 * marketplace cost unit, which shows hourly for GPU (meaningful at that scale) and monthly for CPU-only (so an
 * inexpensive deployment reads as e.g. `$30/month` rather than rounding to `$0.00/hr`).
 */
export function useDeploymentHasGpu(): boolean {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const services = useWatch({ control, name: "services" });
  return useMemo(() => aggregateDeploymentResources(services ?? []).gpu > 0, [services]);
}
