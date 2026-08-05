import type { FC } from "react";
import { useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, CollapsibleCard } from "@akashnetwork/ui/components";
import { NetworkIcon } from "lucide-react";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultGpuModel } from "@src/utils/sdl/data";
import { hasOtherInterconnectService, withGpuInterconnectCapability, withoutGpuInterconnectCapability } from "@src/utils/sdl/gpuInterconnect";
import { gpuInterconnectTooltip } from "../cardTooltips";

export const DEPENDENCIES = { CollapsibleCard, Alert };

type Props = {
  serviceIndex: number;
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "GPU Interconnect" card. A header switch toggles whether the service
 * opts into a high-bandwidth GPU-to-GPU interconnect, persisted as
 * `services.${serviceIndex}.profile.interconnect` (presence = enabled, `{}` =
 * implicit "auto" group). Enabling also turns on the GPU card (an interconnect
 * without GPUs is meaningless) and upserts the placement attribute
 * `capabilities/gpu-interconnect: "true"` so only interconnect-capable providers
 * bid. Disabling clears the opt-in and removes the placement capability (plus
 * any fabric pins) unless another service on the same placement still opts in.
 *
 * The card never mutates on mount, preserving the SDL import round-trip: an
 * imported explicit group (`{ group: "x" }`) simply shows as ON, and toggling it
 * off and on collapses it to the implicit `{}` group (explicit group editing is
 * out of scope here, see CON-692).
 */
export const GpuInterconnectCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const interconnect = useWatch({ control, name: `services.${serviceIndex}.profile.interconnect` });
  const hasGpu = useWatch({ control, name: `services.${serviceIndex}.profile.hasGpu` });
  const count = useWatch({ control, name: `services.${serviceIndex}.count` });
  const watchedServices = useWatch({ control, name: "services" });
  const services = Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : [];

  const isEnabled = !!interconnect;

  /**
   * Enabling turns the GPU card on, but the user can still turn GPU back off afterwards — surface the
   * resulting mismatch since an interconnect only filters providers for a service that requests GPUs.
   */
  const gpuMismatch = isEnabled && !hasGpu;

  const hasParticipatingSibling = hasOtherInterconnectService(services, serviceIndex);
  const showSingleNodeHint = isEnabled && count === 1 && !hasParticipatingSibling;

  /**
   * Brings the GPU card to its enabled state — `profile.hasGpu` on, a count of at least one, and at least
   * one GPU model — matching what the GPU card's own switch does. Only ever turns GPU on (never off), so a
   * GPU the user configured independently, or one left over after toggling the interconnect off, is preserved.
   */
  const enableGpu = useCallback(() => {
    const profile = `services.${serviceIndex}.profile` as const;
    if (!getValues(`${profile}.hasGpu`)) {
      setValue(`${profile}.hasGpu`, true, { shouldDirty: true });
    }
    if ((getValues(`${profile}.gpu`) ?? 0) < 1) {
      setValue(`${profile}.gpu`, 1, { shouldValidate: true, shouldDirty: true });
    }
    if ((getValues(`${profile}.gpuModels`) ?? []).length === 0) {
      setValue(`${profile}.gpuModels`, [{ ...defaultGpuModel }], { shouldDirty: true });
    }
  }, [getValues, serviceIndex, setValue]);

  const setPlacementCapability = useCallback(
    (enabled: boolean) => {
      const placementId = getValues(`services.${serviceIndex}.placementId`);
      const placementIndex = getValues("placements").findIndex(placement => placement.id === placementId);
      if (placementIndex < 0) return;

      const attributes = getValues(`placements.${placementIndex}.attributes`);
      const nextAttributes = enabled ? withGpuInterconnectCapability(attributes) : withoutGpuInterconnectCapability(attributes);
      if (nextAttributes !== attributes) {
        setValue(`placements.${placementIndex}.attributes`, nextAttributes, { shouldDirty: true });
      }
    },
    [getValues, serviceIndex, setValue]
  );

  const toggleInterconnect = useCallback(
    (checked: boolean) => {
      setValue(`services.${serviceIndex}.profile.interconnect`, checked ? {} : undefined, { shouldDirty: true });
      if (checked) {
        enableGpu();
        setPlacementCapability(true);
      } else if (!hasOtherInterconnectService(getValues("services"), serviceIndex)) {
        setPlacementCapability(false);
      }
    },
    [enableGpu, getValues, serviceIndex, setPlacementCapability, setValue]
  );

  return (
    <d.CollapsibleCard
      locked={locked}
      title="GPU Interconnect"
      icon={<NetworkIcon className="h-4 w-4" />}
      infoTooltip={gpuInterconnectTooltip}
      isToggled={isEnabled}
      onToggle={toggleInterconnect}
      toggleAriaLabel="Enable GPU interconnect"
      toggleDisabled={locked}
    >
      {isEnabled ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This service requests a high-bandwidth GPU-to-GPU interconnect; only interconnect-capable providers will bid.
          </p>
          {showSingleNodeHint && (
            <p className="text-sm text-muted-foreground">
              A GPU interconnect links GPUs across 2+ nodes. Increase the replica count under Runtime for a multi-node workload.
            </p>
          )}
          {gpuMismatch && (
            <d.Alert variant="warning" className="p-4 text-sm">
              A GPU interconnect needs GPU resources on this service. Enable the GPU card above so interconnect-capable providers can bid.
            </d.Alert>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">GPU interconnect is off.</p>
      )}
    </d.CollapsibleCard>
  );
};
