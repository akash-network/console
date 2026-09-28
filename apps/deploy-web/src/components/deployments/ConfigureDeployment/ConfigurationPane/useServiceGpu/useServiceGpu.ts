import { useCallback, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultGpuModel } from "@src/utils/sdl/data";

/**
 * A service's GPU as the configure cards edit it: a count where 0 means no GPU, plus the one path that turns the GPU on,
 * shared by the count stepper, the model picker, the interconnect and CPU-GPU confidential compute. Turning the GPU off
 * keeps its models, so counting back up restores them. Nothing here runs on mount, so an imported SDL round-trips untouched.
 */
export function useServiceGpu(serviceIndex: number) {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const profilePath = `services.${serviceIndex}.profile` as const;
  const hasGpu = useWatch({ control, name: `${profilePath}.hasGpu` });
  const gpu = useWatch({ control, name: `${profilePath}.gpu` });

  const seedModelIfNone = useCallback(() => {
    if ((getValues(`${profilePath}.gpuModels`) ?? []).length === 0) {
      setValue(`${profilePath}.gpuModels`, [{ ...defaultGpuModel }], { shouldDirty: true });
    }
  }, [getValues, profilePath, setValue]);

  const setCount = useCallback(
    (count: number) => {
      if (count <= 0) {
        setValue(`${profilePath}.hasGpu`, false, { shouldDirty: true });
        setValue(`${profilePath}.gpu`, 0, { shouldValidate: true, shouldDirty: true });
        return;
      }
      seedModelIfNone();
      setValue(`${profilePath}.gpu`, count, { shouldValidate: true, shouldDirty: true });
      if (!getValues(`${profilePath}.hasGpu`)) {
        setValue(`${profilePath}.hasGpu`, true, { shouldDirty: true });
      }
    },
    [getValues, profilePath, seedModelIfNone, setValue]
  );

  const enable = useCallback(() => {
    if (getValues(`${profilePath}.hasGpu`) && (getValues(`${profilePath}.gpu`) ?? 0) >= 1) {
      seedModelIfNone();
      return;
    }
    setCount(1);
  }, [getValues, profilePath, seedModelIfNone, setCount]);

  const pickFirstModel = useCallback(
    (name: string) => {
      setValue(`${profilePath}.gpuModels`, [{ ...defaultGpuModel, name }], { shouldDirty: true });
      enable();
    },
    [enable, profilePath, setValue]
  );

  const count = hasGpu ? gpu ?? 0 : 0;

  return useMemo(() => ({ count, setCount, enable, pickFirstModel }), [count, setCount, enable, pickFirstModel]);
}
