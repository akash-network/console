import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import get from "lodash/get";
import type { z, ZodObject, ZodRawShape } from "zod";

import type { SdlBuilderFormValuesType } from "@src/types";
import { kvArrayToObject, objectToKvArray } from "@src/utils/keyValue/keyValue";

type Props<T extends ZodObject<ZodRawShape>> = {
  serviceIndex: number;
  schema: T;
};

export const useSdlEnv = <T extends ZodObject<ZodRawShape>>({ serviceIndex, schema }: Props<T>) => {
  const { formState, watch, setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { services } = watch();
  const envValues = useMemo(() => (serviceIndex >= 0 && services[serviceIndex]?.env) || [], [serviceIndex, services[serviceIndex]?.env]);
  const env = useMemo(() => kvArrayToObject(envValues) as z.infer<T>, [envValues]);
  const hasErrors = get(formState.errors, `services.${serviceIndex}.env`);
  const errors = useMemo(() => {
    if (!hasErrors) {
      return {};
    }

    const { success, error } = schema.safeParse(env);

    if (success) {
      return {};
    }

    return error?.errors?.reduce(
      (acc, error) => {
        acc[error.path.join(".")] = error.message;
        return acc;
      },
      {} as Record<string, string>
    );
  }, [env, hasErrors, schema]);

  return useMemo(
    () => ({
      values: env,
      setValue: <K extends keyof z.infer<T>>(key: K, value: z.infer<T>[K]) => {
        if (serviceIndex >= 0) {
          const prev = getValues(`services.${serviceIndex}.env`);
          setValue(`services.${serviceIndex}.env`, objectToKvArray({ ...kvArrayToObject(prev || []), [key]: value }));
        }
      },
      errors: errors as Partial<Record<keyof z.infer<T>, string>>
    }),
    [env, errors, getValues, serviceIndex, setValue]
  );
};
