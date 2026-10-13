import { useFormContext } from "react-hook-form";

import { useServices } from "@src/context/ServicesProvider";
import type { SdlBuilderFormValuesType } from "@src/types";
import { isTrialBlockedGpuSelection } from "@src/utils/deploymentData/v1beta3";
import { useTrialGate } from "../../ConfigurationPane/HardwareSection/useTrialGate/useTrialGate";
import type { GpuSelection } from "../gpuAvailability/gpuAvailability";
import { withGpuCount, withGpuModel, withoutGpu } from "../gpuVariants/gpuVariants";

export const DEPENDENCIES = { useServices, useTrialGate };

const ANALYTICS_SOURCE = "availability_pane";

export type GpuSelectionActions = ReturnType<typeof useGpuSelection>;

/** Applies a pick through the same form change its count screened, so the picked count becomes the one the pane then shows as current. */
export function useGpuSelection(placementId: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { analyticsService } = dependencies.useServices();
  const { isRestricted } = dependencies.useTrialGate();

  function writeChangedGpuProfiles(values: SdlBuilderFormValuesType, next: SdlBuilderFormValuesType) {
    next.services.forEach((service, index) => {
      if (service === values.services[index]) return;
      const profilePath = `services.${index}.profile` as const;
      setValue(`${profilePath}.gpuModels`, service.profile.gpuModels, { shouldDirty: true });
      setValue(`${profilePath}.gpu`, service.profile.gpu, { shouldValidate: true, shouldDirty: true });
      setValue(`${profilePath}.hasGpu`, service.profile.hasGpu, { shouldDirty: true });
    });
  }

  function canSelect(selection: GpuSelection) {
    return selection.kind === "no-gpu" || !(isRestricted && isTrialBlockedGpuSelection(selection.vendor, selection.name));
  }

  function select(selection: GpuSelection) {
    if (!canSelect(selection)) return;
    const values = getValues();

    if (selection.kind === "no-gpu") {
      writeChangedGpuProfiles(values, withoutGpu(values, placementId));
      analyticsService.track("configure_gpu_count_changed", { category: "deployments", count: 0, source: ANALYTICS_SOURCE });
      return;
    }

    writeChangedGpuProfiles(values, withGpuModel(values, placementId, selection));
    analyticsService.track("configure_gpu_type_selected", {
      category: "deployments",
      model: selection.name,
      vendor: selection.vendor,
      source: ANALYTICS_SOURCE
    });
  }

  function selectGpuCount(count: number) {
    const values = getValues();
    writeChangedGpuProfiles(values, withGpuCount(values, placementId, count));
    analyticsService.track("configure_gpu_count_changed", { category: "deployments", count, source: ANALYTICS_SOURCE });
  }

  return { canSelect, select, selectGpuCount };
}
