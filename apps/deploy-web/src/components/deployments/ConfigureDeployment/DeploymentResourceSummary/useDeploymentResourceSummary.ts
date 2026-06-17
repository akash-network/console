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
