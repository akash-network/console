import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { ConfigStatus } from "../DeploymentPane/ConfigStatusIcon/ConfigStatusIcon";
import { isServiceConfigured } from "../DeploymentPane/useServiceStatus/useServiceStatus";

export interface ConfigurationStatus {
  isServiceConfigured: (serviceId: string) => boolean;
  placementStatus: (placementId: string) => ConfigStatus;
}

/** Validates each visible service once per form change, so a card header, a placement tab and the footer never parse the schema on their own. */
export function useConfigurationStatus(): ConfigurationStatus {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control }) as SdlBuilderFormValuesType;
  return useMemo(() => configurationStatusOf(values), [values]);
}

export function configurationStatusOf(values: SdlBuilderFormValuesType): ConfigurationStatus {
  const visibleServices = (values.services ?? []).map((service, index) => ({ service, index })).filter(({ service }) => !isLogCollectorService(service));
  const configured = new Map(visibleServices.map(({ service, index }) => [service.id, isServiceConfigured(values, index)]));

  return {
    isServiceConfigured: serviceId => configured.get(serviceId) ?? false,
    placementStatus: placementId => {
      const statuses = visibleServices.filter(({ service }) => service.placementId === placementId).map(({ service }) => configured.get(service.id));
      const completeCount = statuses.filter(Boolean).length;
      if (completeCount === 0) return "incomplete";
      return completeCount === statuses.length ? "complete" : "partial";
    }
  };
}
