import type { FC } from "react";
import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, ToggleGroup, ToggleGroupItem } from "@akashnetwork/ui/components";
import { LockIcon } from "lucide-react";

import { ConfidentialComputeResources } from "@src/components/deployments/ConfidentialComputeResources";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { TeeType } from "@src/utils/confidentialCompute";
import { buildFormTeeCarveout } from "@src/utils/confidentialCompute";
import { UnlockGpusButton } from "../UnlockGpusButton/UnlockGpusButton";
import { useConfidentialCompute } from "../useConfidentialCompute/useConfidentialCompute";
import { useServiceGpu } from "../useServiceGpu/useServiceGpu";

export const DEPENDENCIES = { ToggleGroup, Alert, ConfidentialComputeResources, UnlockGpusButton };

const TEE_OPTIONS: { value: TeeType; label: string; description: string }[] = [
  { value: "cpu", label: "CPU", description: "Run inside a CPU-only Trusted Execution Environment." },
  { value: "cpu-gpu", label: "CPU-GPU", description: "Attest the GPU as well. This adds a GPU to this service." }
];

type Props = {
  serviceIndex: number;
  locked?: boolean;
  /** A trial wallet can't attest a GPU, while CPU-only confidential compute stays selectable because the API never blocks it. */
  isGpuBlocked?: boolean;
  onUnlock?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfidentialComputeFields: FC<Props> = ({ serviceIndex, locked = false, isGpuBlocked = false, onUnlock, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { count: gpuCount } = useServiceGpu(serviceIndex);
  const { tee, setTee } = useConfidentialCompute(serviceIndex, { isGpuBlocked });
  const attestationLabelId = useId();

  const serviceProfile = useWatch({ control, name: `services.${serviceIndex}.profile` });
  const count = useWatch({ control, name: `services.${serviceIndex}.count` });

  const selectedOption = TEE_OPTIONS.find(option => option.value === tee);
  const gpuMismatch = tee === "cpu-gpu" && gpuCount === 0;

  const carveout =
    tee && serviceProfile
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

  function selectTee(value: string) {
    if (value) setTee(value as TeeType);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Runs this service inside a Trusted Execution Environment (TEE) so its memory stays encrypted and isolated from the provider. All services in a placement
        must agree on their confidential compute type.
      </p>
      <div className="flex flex-col gap-2">
        <span id={attestationLabelId} className="text-sm font-medium">
          Attestation
        </span>
        <d.ToggleGroup
          type="single"
          variant="outline"
          aria-labelledby={attestationLabelId}
          value={tee ?? ""}
          onValueChange={selectTee}
          disabled={locked}
          className="grid grid-cols-2 gap-2"
        >
          {TEE_OPTIONS.map(option => {
            const optionBlocked = isGpuBlocked && option.value === "cpu-gpu";
            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                disabled={locked || optionBlocked}
                className="group h-9 gap-2 font-normal data-[state=on]:border-foreground data-[state=on]:bg-transparent"
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-0 group-data-[state=on]:opacity-100" />
                </span>
                {option.label}
                {optionBlocked && <LockIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Requires credits" />}
              </ToggleGroupItem>
            );
          })}
        </d.ToggleGroup>
        {selectedOption && <p className="text-xs text-muted-foreground">{selectedOption.description}</p>}
      </div>
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
    </div>
  );
};
