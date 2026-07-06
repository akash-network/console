import type { FC } from "react";
import { useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Alert, CollapsibleCard, Label, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { ShieldCheckIcon } from "lucide-react";

import { ConfidentialComputeResources } from "@src/components/deployments/ConfidentialComputeResources";
import type { SdlBuilderFormValuesType } from "@src/types";
import { buildFormTeeCarveout } from "@src/utils/confidentialCompute";
import { defaultGpuModel } from "@src/utils/sdl/data";
import { confidentialComputeTooltip } from "../cardTooltips";

export const DEPENDENCIES = { CollapsibleCard, RadioGroup, RadioGroupItem, Label, Alert, ConfidentialComputeResources };

type ServiceParams = NonNullable<SdlBuilderFormValuesType["services"][number]["params"]>;
type TeeType = NonNullable<ServiceParams["tee"]>;

const TEE_OPTIONS: { value: TeeType; label: string; description: string }[] = [
  { value: "cpu", label: "CPU", description: "Run inside a CPU-only Trusted Execution Environment." },
  { value: "cpu-gpu", label: "CPU-GPU", description: "Attest the GPU as well — this enables the GPU card for this service." }
];

/** TEE type a freshly enabled card defaults to. CPU is the least restrictive and needs no GPU resources. */
const DEFAULT_TEE: TeeType = "cpu";

type Props = {
  serviceIndex: number;
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Hardware "Confidential Compute" card. A header switch toggles whether the
 * service requests a Trusted Execution Environment, persisted as
 * `services.${serviceIndex}.params.tee`. Enabling defaults to `cpu`; the body
 * then offers a radio choice between `cpu` and `cpu-gpu`. Disabling clears `tee`
 * while preserving any other `params` (e.g. log-collector `permissions`), and
 * drops `params` entirely once nothing is left so the generated SDL stays clean.
 *
 * Picking `cpu-gpu` attests the GPU, so it enables the GPU card for this service
 * (sets `profile.hasGpu`, a count of at least one, and a default GPU model) — the
 * same state that card's own switch produces — so the attested GPU is backed by
 * real GPU resources and the SDL stays valid. Cross-service TEE conflicts within a
 * placement group are still caught by the SDL validator before requesting quotes.
 *
 * The body renders only while the card is open: an open, switched-off card is
 * reachable only when the pane is locked, where the short off-state hint just
 * tells the viewer no confidential compute is configured.
 */
export const ConfidentialComputeCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const tee = useWatch({ control, name: `services.${serviceIndex}.params.tee` });
  const isEnabled = tee === "cpu" || tee === "cpu-gpu";

  // Watch the declared resources so the attestation-sidecar preview recomputes as the user edits CPU/RAM.
  const serviceProfile = useWatch({ control, name: `services.${serviceIndex}.profile` });
  const count = useWatch({ control, name: `services.${serviceIndex}.count` });

  // Picking cpu-gpu enables the GPU card, but the user can still turn GPU back off afterwards — surface the
  // resulting mismatch since a cpu-gpu enclave attests a GPU and the SDL validator rejects it without one.
  const gpuMismatch = tee === "cpu-gpu" && !serviceProfile?.hasGpu;

  const carveout =
    isEnabled && tee && serviceProfile
      ? buildFormTeeCarveout({
          id: getValues(`services.${serviceIndex}.id`) ?? getValues(`services.${serviceIndex}.title`),
          cpu: serviceProfile.cpu,
          ram: serviceProfile.ram,
          ramUnit: serviceProfile.ramUnit,
          count,
          gpu: serviceProfile.gpu,
          teeType: tee
        })
      : undefined;

  /**
   * Brings the GPU card to its enabled state — `profile.hasGpu` on, a count of at least one, and at least
   * one GPU model — matching what the GPU card's own switch does. Only ever turns GPU on (never off), so a
   * GPU the user configured independently, or one left over after switching back to `cpu`, is preserved.
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

  const setTee = useCallback(
    (value: TeeType | undefined) => {
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
    [enableGpu, getValues, serviceIndex, setValue]
  );

  const toggleConfidentialCompute = useCallback(
    (checked: boolean) => {
      setTee(checked ? DEFAULT_TEE : undefined);
    },
    [setTee]
  );

  return (
    <d.CollapsibleCard
      locked={locked}
      title="Confidential Compute"
      icon={<ShieldCheckIcon className="h-4 w-4" />}
      infoTooltip={confidentialComputeTooltip}
      isToggled={isEnabled}
      onToggle={toggleConfidentialCompute}
      toggleAriaLabel="Enable confidential compute"
      toggleDisabled={locked}
    >
      {isEnabled ? (
        <div className="space-y-4">
          <d.RadioGroup
            aria-label="Confidential compute type"
            value={tee}
            onValueChange={value => setTee(value as TeeType)}
            className="gap-3"
            disabled={locked}
          >
            {TEE_OPTIONS.map(option => {
              const id = `tee-${serviceIndex}-${option.value}`;
              return (
                <d.Label
                  key={option.value}
                  htmlFor={id}
                  className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 font-normal dark:border-zinc-800"
                >
                  <d.RadioGroupItem id={id} value={option.value} aria-label={option.label} disabled={locked} className="mt-0.5" />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </d.Label>
              );
            })}
          </d.RadioGroup>
          {gpuMismatch && (
            <d.Alert variant="warning">
              CPU-GPU confidential compute attests a GPU, so this service needs GPU resources. Enable the GPU card above so providers with confidential-compute
              GPUs can bid.
            </d.Alert>
          )}
          {carveout && <d.ConfidentialComputeResources carveouts={[carveout]} />}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Confidential compute is off.</p>
      )}
    </d.CollapsibleCard>
  );
};
