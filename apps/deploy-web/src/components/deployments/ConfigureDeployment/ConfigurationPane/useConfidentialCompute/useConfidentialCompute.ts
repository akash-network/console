import { useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { TeeType } from "@src/utils/confidentialCompute";
import { useServiceGpu } from "../useServiceGpu/useServiceGpu";

type ServiceParams = NonNullable<SdlBuilderFormValuesType["services"][number]["params"]>;

/** CPU is the least restrictive TEE type and needs no GPU. */
const DEFAULT_TEE: TeeType = "cpu";

/** Turning confidential compute off keeps the service's other params and drops `params` once empty so the SDL stays clean. */
export function useConfidentialCompute(serviceIndex: number, { isGpuBlocked = false }: { isGpuBlocked?: boolean } = {}) {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const { enable: enableGpu } = useServiceGpu(serviceIndex);
  const tee = useWatch({ control, name: `services.${serviceIndex}.params.tee` });

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

  const setEnabled = useCallback(
    (enabled: boolean) => {
      setTee(enabled ? DEFAULT_TEE : undefined);
    },
    [setTee]
  );

  return { tee, isEnabled: tee === "cpu" || tee === "cpu-gpu", setTee, setEnabled };
}
