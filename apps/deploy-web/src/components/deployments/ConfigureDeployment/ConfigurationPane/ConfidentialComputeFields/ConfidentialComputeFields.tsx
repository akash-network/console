import type { FC } from "react";
import { useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, Label, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { LockIcon } from "lucide-react";

import { ConfidentialComputeResources } from "@src/components/deployments/ConfidentialComputeResources";
import type { SdlBuilderFormValuesType } from "@src/types";
import { buildFormTeeCarveout } from "@src/utils/confidentialCompute";
import { ToggleRow } from "../ToggleRow/ToggleRow";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";
import { useServiceGpu } from "../useServiceGpu/useServiceGpu";

export const DEPENDENCIES = { ToggleRow, RadioGroup, RadioGroupItem, Label, Alert, ConfidentialComputeResources, UnlockGpusButton };

type ServiceParams = NonNullable<SdlBuilderFormValuesType["services"][number]["params"]>;
type TeeType = NonNullable<ServiceParams["tee"]>;

const TEE_OPTIONS: { value: TeeType; label: string; description: string }[] = [
  { value: "cpu", label: "CPU", description: "Run inside a CPU-only Trusted Execution Environment." },
  { value: "cpu-gpu", label: "CPU-GPU", description: "Attest the GPU as well. This adds a GPU to this service." }
];

/** CPU is the least restrictive TEE type and needs no GPU. */
const DEFAULT_TEE: TeeType = "cpu";

type Props = {
  serviceIndex: number;
  locked?: boolean;
  /** A trial wallet can't attest a GPU, while CPU-only confidential compute stays selectable because the API never blocks it. */
  isGpuBlocked?: boolean;
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** The Security card's confidential compute opt-in; turning it off keeps the service's other params and drops `params` once empty so the SDL stays clean. */
export const ConfidentialComputeFields: FC<Props> = ({ serviceIndex, locked = false, isGpuBlocked = false, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { count: gpuCount, enable: enableGpu } = useServiceGpu(serviceIndex);
  const tee = useWatch({ control, name: `services.${serviceIndex}.params.tee` });
  const isEnabled = tee === "cpu" || tee === "cpu-gpu";

  const serviceProfile = useWatch({ control, name: `services.${serviceIndex}.profile` });
  const count = useWatch({ control, name: `services.${serviceIndex}.count` });

  const gpuMismatch = tee === "cpu-gpu" && gpuCount === 0;

  const carveout =
    isEnabled && tee && serviceProfile
      ? buildFormTeeCarveout({
          id: getValues(`services.${serviceIndex}.id`) ?? getValues(`services.${serviceIndex}.title`),
          cpu: serviceProfile.cpu,
          ram: serviceProfile.ram,
          ramUnit: serviceProfile.ramUnit,
          count,
          gpu: gpuCount,
          teeType: tee
        })
      : undefined;

  const setTee = useCallback(
    (value: TeeType | undefined) => {
      if (value === "cpu-gpu" && isGpuBlocked) return;
      const params = getValues(`services.${serviceIndex}.params`);
      const nextParams: ServiceParams = { ...params, tee: value };
      if (!value) {
        delete nextParams.tee;
      }
      const isEmpty = Object.values(nextParams).every(entry => entry === undefined);
      setValue(`services.${serviceIndex}.params`, isEmpty ? undefined : nextParams, { shouldDirty: true });

      if (value === "cpu-gpu") {
        enableGpu();
      }
    },
    [enableGpu, getValues, isGpuBlocked, serviceIndex, setValue]
  );

  const toggleConfidentialCompute = useCallback(
    (checked: boolean) => {
      setTee(checked ? DEFAULT_TEE : undefined);
    },
    [setTee]
  );

  return (
    <div className="flex flex-col gap-4">
      <d.ToggleRow
        label="Confidential compute"
        description="Require hardware-backed TEE providers."
        switchLabel="Enable confidential compute"
        checked={isEnabled}
        onCheckedChange={toggleConfidentialCompute}
        disabled={locked}
      />
      {isEnabled && (
        <>
          <d.RadioGroup
            aria-label="Confidential compute type"
            value={tee}
            onValueChange={value => setTee(value as TeeType)}
            className="gap-3"
            disabled={locked}
          >
            {TEE_OPTIONS.map(option => {
              const id = `tee-${serviceIndex}-${option.value}`;
              const optionBlocked = isGpuBlocked && option.value === "cpu-gpu";
              return (
                <d.Label
                  key={option.value}
                  htmlFor={id}
                  className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 font-normal dark:border-zinc-800"
                >
                  <d.RadioGroupItem id={id} value={option.value} aria-label={option.label} disabled={locked || optionBlocked} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {option.label}
                      {optionBlocked && <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Requires credits" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </d.Label>
              );
            })}
          </d.RadioGroup>
          {isGpuBlocked && (
            <d.Alert variant="warning" className="p-4">
              <div className="flex flex-col items-start gap-2 text-sm">
                <p>High-end GPUs aren&apos;t available on a free trial. Add credits to attest a GPU, or use CPU-only confidential compute.</p>
                <d.UnlockGpusButton onUnlock={onUnlock} prominent />
              </div>
            </d.Alert>
          )}
          {gpuMismatch && (
            <d.Alert variant="warning" className="p-4 text-sm">
              CPU-GPU confidential compute attests a GPU, so this service needs GPUs. Set GPUs to 1 or more so providers with confidential-compute GPUs can bid.
            </d.Alert>
          )}
          {carveout && <d.ConfidentialComputeResources carveouts={[carveout]} />}
        </>
      )}
    </div>
  );
};
