import { useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import get from "lodash/get";
import type { ZodObject, ZodRawShape } from "zod";

import type { SdlBuilderFormValuesType } from "@src/types";
import { kvArrayToObject } from "@src/utils/keyValue";

export const useSdlEnv = (serviceIndex: number, schema: ZodObject<ZodRawShape>) => {
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
  const errors = useMemo(() => {
    if (!get(formState.errors, `services.${serviceIndex}.env`)) {
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
  }, [env, formState.errors, schema, serviceIndex]);

  return useMemo(
    () => ({
      getValue: (key: string) => (key in indexes ? fields[indexes[key]].value : ""),
      setValue: (key: string, value: string) => {
        const hasKey = key in indexes;
        if (hasKey && value) {
          update(indexes[key], {
            key,
            value
          });
        } else if (hasKey) {
          remove(indexes[key]);
        } else {
          append({ key, value });
        }
      },
      errors
    }),
    [append, errors, fields, indexes, remove, update]
  );
};
