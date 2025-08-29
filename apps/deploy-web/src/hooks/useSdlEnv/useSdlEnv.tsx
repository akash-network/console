import { useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import get from "lodash/get";
import type { z, ZodObject, ZodRawShape } from "zod";

import type { SdlBuilderFormValuesType } from "@src/types";
import { kvArrayToObject } from "@src/utils/keyValue/keyValue";

type Props<T extends ZodObject<ZodRawShape>> = {
  serviceIndex: number;
  schema: T;
};

export const useSdlEnv = <T extends ZodObject<ZodRawShape>>({ serviceIndex, schema }: Props<T>) => {
  const { control, formState } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, update, remove } = useFieldArray({
    control,
    name: `services.${serviceIndex}.env`,
    keyName: "id"
  });

  const indexes = useMemo(() => {
    return fields.reduce(
      (acc, env, index) => {
        acc[env.key] = index;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [fields]);

  const env = useMemo(() => kvArrayToObject(fields), [fields]);

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
      getValue: (key: keyof z.infer<T>) => (key in indexes ? fields[indexes[key as string]].value : ""),
      setValue: (key: keyof z.infer<T>, value: string) => {
        const hasKey = key in indexes;
        if (hasKey && value) {
          update(indexes[key as string], {
            key: key as string,
            value
          });
        } else if (hasKey) {
          remove(indexes[key as string]);
        } else {
          append({ key: key as string, value });
        }
      },
      errors: errors as Partial<Record<keyof z.infer<T>, string>>
    }),
    [append, errors, fields, indexes, remove, update]
  );
};
