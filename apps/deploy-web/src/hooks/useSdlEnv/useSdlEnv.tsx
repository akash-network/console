import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import get from "lodash/get";
import type { z, ZodObject, ZodRawShape } from "zod";

import type { SdlBuilderFormValuesType } from "@src/types";
import { kvArrayToObject } from "@src/utils/keyValue/keyValue";

type Props<T extends ZodObject<ZodRawShape>> = {
  serviceIndex: number;
  schema: T;
};

type EnvField = NonNullable<SdlBuilderFormValuesType["services"][number]["env"]>[number];

export const useSdlEnv = <T extends ZodObject<ZodRawShape>>({ serviceIndex, schema }: Props<T>) => {
  const { formState, watch, setValue, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { services } = watch();
  const envValues = useMemo(() => (serviceIndex >= 0 && services[serviceIndex].env) || [], [serviceIndex, services]);
  const append = useCallback(
    (value: EnvField) => {
      if (serviceIndex >= 0) {
        const prev = getValues(`services.${serviceIndex}.env`) || [];
        setValue(`services.${serviceIndex}.env`, [...prev, value]);
      }
    },
    [getValues, serviceIndex, setValue]
  );
  const update = useCallback(
    (index: number, value: EnvField) => {
      if (serviceIndex >= 0) {
        setValue(`services.${serviceIndex}.env.${index}`, value);
      }
    },
    [serviceIndex, setValue]
  );
  const remove = useCallback(
    (index: number) => {
      if (serviceIndex >= 0) {
        const newFields = envValues.splice(index, 1);
        setValue(`services.${serviceIndex}.env`, newFields);
      }
    },
    [envValues, setValue, serviceIndex]
  );

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
      setValue: (key: keyof z.infer<T>, value: string) => {
        const index = envValues.findIndex(env => env.key === key);
        const hasKey = index >= 0;

        if (hasKey && value) {
          update(index, {
            key: key as string,
            value
          });
        } else if (hasKey) {
          remove(index);
        } else {
          append({ key: key as string, value });
        }
      },
      errors: errors as Partial<Record<keyof z.infer<T>, string>>
    }),
    [append, env, envValues, errors, remove, update]
  );
};
