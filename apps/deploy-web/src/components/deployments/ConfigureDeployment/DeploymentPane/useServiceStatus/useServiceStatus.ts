import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";

/** Whether the service at `serviceIndex` passes every existing validation rule. */
export const useServiceStatus = (serviceIndex: number): boolean => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const values = useWatch({ control });

  return useMemo(() => isServiceConfigured(values as SdlBuilderFormValuesType, serviceIndex), [values, serviceIndex]);
};

/**
 * Validates a single-service projection of the form values against the full
 * schema so per-service and cross-field rules both apply, while issues on
 * other parts of the form (e.g. placements) don't bleed into this service.
 * Cross-service rules (e.g. duplicate titles) are intentionally out of scope
 * for this indicator — the form-level resolver still reports them inline.
 */
export function isServiceConfigured(values: SdlBuilderFormValuesType, serviceIndex: number): boolean {
  const service = values.services?.[serviceIndex];
  if (!service) {
    return false;
  }
  const result = SdlBuilderFormValuesSchema.safeParse({ ...values, services: [service] });
  return result.success || !result.error.issues.some(issue => issue.path[0] === "services");
}
