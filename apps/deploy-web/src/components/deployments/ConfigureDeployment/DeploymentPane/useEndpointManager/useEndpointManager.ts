import { useCallback, useMemo } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultEndpoint } from "@src/utils/sdl/data";
import { mergeFieldValues, nextEndpointName } from "@src/utils/sdl/formArrayHelpers";
import { useRevalidateUniqueness } from "../useRevalidateUniqueness/useRevalidateUniqueness";

export const useEndpointManager = () => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const watchedEndpoints = useWatch<SdlBuilderFormValuesType>({ control, name: "endpoints" });
  const { fields, append, remove } = useFieldArray({ control, name: "endpoints", keyName: "fieldId" });

  useRevalidateUniqueness("endpoints", endpoint => endpoint.name);

  const endpoints = useMemo(() => mergeFieldValues(fields, watchedEndpoints as SdlBuilderFormValuesType["endpoints"]), [fields, watchedEndpoints]);

  const addEndpoint = useCallback(() => {
    append(defaultEndpoint({ name: nextEndpointName(getValues("endpoints") ?? []) }));
  }, [append, getValues]);

  const removeEndpoint = useCallback(
    (endpointId: string) => {
      const index = (getValues("endpoints") ?? []).findIndex(endpoint => endpoint.id === endpointId);
      if (index === -1) {
        return;
      }
      remove(index);
    },
    [getValues, remove]
  );

  return useMemo(() => ({ endpoints, addEndpoint, removeEndpoint }), [endpoints, addEndpoint, removeEndpoint]);
};
