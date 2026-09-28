import type { UseFormReturn, UseFormSetValue } from "react-hook-form";
import { useWatch } from "react-hook-form";

import {
  findOwnLogCollectorServiceIndex,
  isLogCollectorService,
  toLogCollectorTitle,
  toPodLabelSelector
} from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import { useThrottledEffect } from "@src/hooks/useThrottledEffect/useThrottledEffect";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { kvArrayToObject, objectToKvArray } from "@src/utils/keyValue/keyValue";

type SetValue = UseFormSetValue<SdlBuilderFormValuesType>;

/** Runs at the form level because a service can be renamed or moved while no card of that service is on screen. */
export function useSyncLogCollectors(form: UseFormReturn<SdlBuilderFormValuesType>) {
  const services = useWatch({ control: form.control, name: "services" });

  useThrottledEffect(() => {
    syncLogCollectors(form.getValues("services"), form.setValue);
  }, [services, form]);
}

/** Points every log collector back at its service: title, placement, pricing and the pod selector that targets the service by title. */
export function syncLogCollectors(services: ServiceType[], setValue: SetValue) {
  services.forEach(service => {
    if (isLogCollectorService(service)) return;
    const collectorIndex = findOwnLogCollectorServiceIndex(service, services);
    if (collectorIndex !== -1) {
      syncCollector(services[collectorIndex], collectorIndex, service, setValue);
    }
  });
}

function syncCollector(collector: ServiceType, collectorIndex: number, parent: ServiceType, setValue: SetValue) {
  const title = toLogCollectorTitle(parent);
  if (collector.title !== title) {
    setValue(`services.${collectorIndex}.title`, title, { shouldDirty: true });
  }

  if (collector.placementId !== parent.placementId) {
    setValue(`services.${collectorIndex}.placementId`, parent.placementId, { shouldDirty: true });
  }

  if (collector.pricing.amount !== parent.pricing.amount || collector.pricing.denom !== parent.pricing.denom) {
    setValue(`services.${collectorIndex}.pricing`, parent.pricing, { shouldDirty: true });
  }

  const podLabelSelector = toPodLabelSelector(parent);
  const env = kvArrayToObject(collector.env ?? []);
  if (env.POD_LABEL_SELECTOR !== podLabelSelector) {
    setValue(`services.${collectorIndex}.env`, objectToKvArray({ ...env, POD_LABEL_SELECTOR: podLabelSelector }), { shouldDirty: true });
  }
}
