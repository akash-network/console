import type { FC } from "react";
import { useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, Input, Label, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";

import type { PlacementAttributeType, SdlBuilderFormValuesType } from "@src/types";
import type { GpuInterconnectFabric } from "@src/utils/sdl/gpuInterconnect";
import {
  getGpuInterconnectFabric,
  hasMixedInterconnectGroupForms,
  hasOtherInterconnectService,
  withGpuInterconnectCapability,
  withGpuInterconnectFabric,
  withoutGpuInterconnectCapability
} from "@src/utils/sdl/gpuInterconnect";
import { ToggleRow } from "../ToggleRow/ToggleRow";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";
import { useServiceGpu } from "../useServiceGpu/useServiceGpu";

export const DEPENDENCIES = { ToggleRow, Alert, Input, Label, RadioGroup, RadioGroupItem, UnlockGpusButton };

/** Hover explanation for the trial unlock CTA; mirrors the phrasing of the high-end GPU unlock copy. */
const INTERCONNECT_UNLOCK_EXPLANATION =
  "GPU interconnect isn't included in your free trial. Add credits to unlock it, along with longer runtimes and the full Console.";

/** "any" = no fabric pin, the provider chooses; the two pinned choices emit a placement capability. */
type FabricChoice = GpuInterconnectFabric | "any";

const FABRIC_OPTIONS: { value: FabricChoice; label: string; description: string }[] = [
  { value: "any", label: "Any", description: "Let the provider choose the interconnect fabric." },
  { value: "infiniband", label: "InfiniBand", description: "Only providers offering an InfiniBand fabric will bid." },
  { value: "roce", label: "RoCE", description: "Only providers offering an RDMA over Converged Ethernet fabric will bid." }
];

type Props = {
  serviceIndex: number;
  locked?: boolean;
  /** A trial wallet can't opt in, but an interconnect imported already on stays switchable so it can be turned off to deploy. */
  isTrialBlocked?: boolean;
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** The GPU card's interconnect opt-in; the placement capability it adds is shared with sibling services, so turning it off keeps it while one still opts in. */
export const GpuInterconnectFields: FC<Props> = ({ serviceIndex, locked = false, isTrialBlocked = false, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { enable: enableGpu } = useServiceGpu(serviceIndex);
  const interconnect = useWatch({ control, name: `services.${serviceIndex}.profile.interconnect` });
  const hasGpu = useWatch({ control, name: `services.${serviceIndex}.profile.hasGpu` });
  const count = useWatch({ control, name: `services.${serviceIndex}.count` });
  const placementId = useWatch({ control, name: `services.${serviceIndex}.placementId` });
  const watchedServices = useWatch({ control, name: "services" });
  const services = Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : [];
  const watchedPlacements = useWatch({ control, name: "placements" });
  const placements = Array.isArray(watchedPlacements) ? (watchedPlacements as SdlBuilderFormValuesType["placements"]) : [];

  const isEnabled = !!interconnect;
  const controlsDisabled = locked || isTrialBlocked;
  const fabric = getGpuInterconnectFabric(placements.find(placement => placement.id === placementId)?.attributes);

  const groupIsReserved = interconnect?.group === "auto";
  const hasMixedForms = isEnabled && hasMixedInterconnectGroupForms(services, serviceIndex);
  const gpuMismatch = isEnabled && !hasGpu;

  const hasParticipatingSibling = hasOtherInterconnectService(services, serviceIndex);
  const showSingleNodeHint = isEnabled && count === 1 && !hasParticipatingSibling;

  const updatePlacementAttributes = useCallback(
    (transform: (attributes: PlacementAttributeType[] | undefined) => PlacementAttributeType[] | undefined) => {
      const currentPlacementId = getValues(`services.${serviceIndex}.placementId`);
      const placementIndex = getValues("placements").findIndex(placement => placement.id === currentPlacementId);
      if (placementIndex < 0) return;

      const attributes = getValues(`placements.${placementIndex}.attributes`);
      const nextAttributes = transform(attributes);
      if (nextAttributes !== attributes) {
        setValue(`placements.${placementIndex}.attributes`, nextAttributes, { shouldDirty: true });
      }
    },
    [getValues, serviceIndex, setValue]
  );

  const setPlacementCapability = useCallback(
    (enabled: boolean) => {
      updatePlacementAttributes(attributes => (enabled ? withGpuInterconnectCapability(attributes) : withoutGpuInterconnectCapability(attributes)));
    },
    [updatePlacementAttributes]
  );

  const setFabric = useCallback(
    (choice: FabricChoice) => {
      updatePlacementAttributes(attributes => withGpuInterconnectFabric(attributes, choice === "any" ? undefined : choice));
    },
    [updatePlacementAttributes]
  );

  const setGroup = useCallback(
    (name: string) => {
      setValue(`services.${serviceIndex}.profile.interconnect`, name === "" ? {} : { group: name }, { shouldDirty: true });
    },
    [serviceIndex, setValue]
  );

  const toggleInterconnect = useCallback(
    (checked: boolean) => {
      if (checked && isTrialBlocked) return;
      setValue(`services.${serviceIndex}.profile.interconnect`, checked ? {} : undefined, { shouldDirty: true });
      if (checked) {
        enableGpu();
        setPlacementCapability(true);
      } else if (!hasOtherInterconnectService(getValues("services"), serviceIndex)) {
        setPlacementCapability(false);
      }
    },
    [enableGpu, getValues, isTrialBlocked, serviceIndex, setPlacementCapability, setValue]
  );

  return (
    <div className="flex flex-col gap-4">
      <d.ToggleRow
        label="GPU interconnect"
        description="High-bandwidth GPU-to-GPU fabric for multi-node jobs."
        switchLabel="Enable GPU interconnect"
        checked={isEnabled}
        onCheckedChange={toggleInterconnect}
        disabled={locked || (isTrialBlocked && !isEnabled)}
      />
      {isEnabled && (
        <>
          <p className="text-sm text-muted-foreground">This service requests a high-bandwidth GPU-to-GPU interconnect; only interconnect-capable providers will bid.</p>
          {showSingleNodeHint && (
            <p className="text-sm text-muted-foreground">
              A GPU interconnect links GPUs across 2+ nodes. Increase the replica count under Runtime for a multi-node workload.
            </p>
          )}
          {gpuMismatch && (
            <d.Alert variant="warning" className="p-4 text-sm">
              A GPU interconnect needs GPUs on this service. Set GPUs to 1 or more so interconnect-capable providers can bid.
            </d.Alert>
          )}
          <div className="space-y-2">
            <d.Input
              id={`interconnect-group-${serviceIndex}`}
              label="Interconnect group"
              value={interconnect?.group ?? ""}
              onChange={event => setGroup(event.target.value)}
              placeholder="auto"
              disabled={controlsDisabled}
            />
            <p className="text-xs text-muted-foreground">Leave empty for the automatic group. Services that opt in without a name share one group per placement.</p>
          </div>
          {groupIsReserved && (
            <d.Alert variant="warning" className="p-4 text-sm">
              The group name &quot;auto&quot; is reserved for the automatic group. Leave the field empty instead, or pick a different name.
            </d.Alert>
          )}
          {hasMixedForms && (
            <d.Alert variant="warning" className="p-4 text-sm">
              Services on this placement mix automatic and named interconnect groups, which is rejected at deploy time. Use one form for every service on the
              placement.
            </d.Alert>
          )}
          <div className="space-y-2">
            <d.Label>Fabric</d.Label>
            <d.RadioGroup
              aria-label="Interconnect fabric"
              value={fabric ?? "any"}
              onValueChange={value => setFabric(value as FabricChoice)}
              className="gap-3"
              disabled={controlsDisabled}
            >
              {FABRIC_OPTIONS.map(option => {
                const id = `interconnect-fabric-${serviceIndex}-${option.value}`;
                return (
                  <d.Label key={option.value} htmlFor={id} className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 font-normal dark:border-zinc-800">
                    <d.RadioGroupItem id={id} value={option.value} aria-label={option.label} disabled={controlsDisabled} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </span>
                  </d.Label>
                );
              })}
            </d.RadioGroup>
            <p className="text-xs text-muted-foreground">The fabric applies to the whole placement, including sibling services that opt in.</p>
          </div>
        </>
      )}
      {isTrialBlocked && (
        <d.Alert variant="warning" className="p-4">
          <div className="flex flex-col items-start gap-2 text-sm">
            <p>
              {isEnabled
                ? "GPU interconnect isn't available on a free trial, so this deployment would be rejected. Add credits to unlock it, or turn it off."
                : "GPU interconnect isn't available on a free trial. Add credits to unlock it."}
            </p>
            <d.UnlockGpusButton onUnlock={onUnlock} prominent label="Unlock GPU interconnect" explanation={INTERCONNECT_UNLOCK_EXPLANATION} />
          </div>
        </d.Alert>
      )}
    </div>
  );
};
