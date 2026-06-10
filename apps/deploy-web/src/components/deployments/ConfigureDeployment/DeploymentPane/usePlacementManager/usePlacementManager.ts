import { useCallback, useMemo } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { nextPlacementName, nextServiceTitle, serviceRemovalIndexes } from "@src/utils/sdl/formArrayHelpers";

export type IndexedService = { service: ServiceType; index: number };

export const usePlacementManager = () => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const watchedPlacements = useWatch<SdlBuilderFormValuesType>({ control, name: "placements" });
  const watchedServices = useWatch<SdlBuilderFormValuesType>({ control, name: "services" });

  const { fields: placementFields, append: appendPlacement, remove: removePlacementsAt } = useFieldArray({ control, name: "placements", keyName: "fieldId" });
  const { fields: serviceFields, append: appendService, remove: removeServicesAt } = useFieldArray({ control, name: "services", keyName: "fieldId" });

  /**
   * Each array is read from two RHF sources because neither alone is enough:
   * `useFieldArray().fields` carries the structure/order RHF re-indexes against
   * but stale values, while `useWatch` carries live edits but not the structure.
   * {@link mergeFieldValues} combines them. The memo keeps a stable reference so
   * the dependent `visibleServices` memo and the action callbacks below don't
   * invalidate on unrelated renders.
   */
  const placements = useMemo(
    () => mergeFieldValues(placementFields, watchedPlacements as SdlBuilderFormValuesType["placements"]),
    [placementFields, watchedPlacements]
  );
  const services = useMemo(() => mergeFieldValues(serviceFields, watchedServices as SdlBuilderFormValuesType["services"]), [serviceFields, watchedServices]);

  const visibleServices = useMemo<IndexedService[]>(
    () => services.map((service, index) => ({ service, index })).filter(({ service }) => !isLogCollectorService(service)),
    [services]
  );

  const getPlacementServices = useCallback(
    (placementId: string) => visibleServices.filter(({ service }) => service.placementId === placementId),
    [visibleServices]
  );

  const addPlacement = useCallback(() => {
    appendPlacement(defaultPlacement({ name: nextPlacementName(getValues("placements")) }));
  }, [appendPlacement, getValues]);

  const canRemovePlacement = placements.length > 1;

  const removePlacement = useCallback(
    (placementId: string) => {
      const placementIndex = getValues("placements").findIndex(placement => placement.id === placementId);
      if (placementIndex === -1) {
        return;
      }
      const serviceIndexes = getValues("services")
        .map((service, index) => ({ service, index }))
        .filter(({ service }) => service.placementId === placementId)
        .map(({ index }) => index);
      removeServicesAt(serviceIndexes);
      removePlacementsAt(placementIndex);
    },
    [getValues, removeServicesAt, removePlacementsAt]
  );

  const addService = useCallback(
    (placementId: string) => {
      const service = defaultService(placementId, { title: nextServiceTitle(getValues("services")) });
      appendService(service);
      return service.id as string;
    },
    [appendService, getValues]
  );

  const canRemoveService = visibleServices.length > 1;

  const removeService = useCallback(
    (serviceId: string) => {
      const currentServices = getValues("services");
      const index = currentServices.findIndex(service => service.id === serviceId);
      if (index === -1) {
        return;
      }
      removeServicesAt(serviceRemovalIndexes(currentServices, index));
    },
    [getValues, removeServicesAt]
  );

  return useMemo(
    () => ({
      placements,
      getPlacementServices,
      addPlacement,
      canRemovePlacement,
      removePlacement,
      addService,
      canRemoveService,
      removeService
    }),
    [placements, getPlacementServices, addPlacement, canRemovePlacement, removePlacement, addService, canRemoveService, removeService]
  );
};

/**
 * Controlled field-array merge (per react-hook-form docs): `fields` is the
 * single source of truth for structure and ordering — which keeps the
 * library's internal re-index bookkeeping consistent with what is rendered —
 * while the watched values overlay live field edits (e.g. renames).
 *
 * Rendering from watched values alone drifts from RHF's field registry on
 * removal: index-based Controllers (`services.${i}.title`) shift their
 * registered path and the abandoned registration resurrects as a partial
 * `{ name }`/`{ title }`-only ghost row. Reading `fields[i]` alone instead
 * shows stale text until the next structural mutation. Merging avoids both.
 */
function mergeFieldValues<T extends object>(fields: (T & { fieldId: string })[], values: T[] | undefined): T[] {
  const liveValues = Array.isArray(values) ? values : [];
  return fields.map((field, index) => ({ ...field, ...liveValues[index] }));
}
