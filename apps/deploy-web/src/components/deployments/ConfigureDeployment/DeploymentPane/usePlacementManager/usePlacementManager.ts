import { useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { mergeFieldValues, nextPlacementName, nextServiceTitle, serviceRemovalIndexes } from "@src/utils/sdl/formArrayHelpers";
import { readServiceSshKey, withServiceSshKey } from "@src/utils/sdl/sshKey";
import { applyPresetToProfile, DEFAULT_HARDWARE_PRESET } from "../../ConfigurationPane/PresetsCard/hardwarePresets";
import { useRevalidateUniqueness } from "../useRevalidateUniqueness/useRevalidateUniqueness";

export type IndexedService = { service: ServiceType; index: number };

type SelectionControls = {
  /**
   * Blurs the ConfigurationPane's selection (pass ""). Used to unmount every card around a structural
   * removal so react-hook-form can't resurrect a "ghost" service; reselection is left to the caller's
   * reselect effect, which runs after the splice commits.
   */
  onSelectService?: (serviceId: string) => void;
};

export const usePlacementManager = ({ onSelectService }: SelectionControls = {}) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();

  useRevalidateUniqueness("placements", placement => placement.name);
  useRevalidateUniqueness("services", service => service.title);

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
    const placement = defaultPlacement({ name: nextPlacementName(getValues("placements")) });
    const service = newConfigureService(placement.id as string, getValues());
    appendPlacement(placement);
    appendService(service);
    return service.id as string;
  }, [appendPlacement, appendService, getValues]);

  /**
   * Runs a structural splice of the services array without leaving a resurrected "ghost" service behind.
   *
   * A ConfigurationPane card registers its service index via `useController`, and react-hook-form keeps
   * registered values across unmounts (`shouldUnregister` is off). Splicing the array while a card is mounted
   * — whether on the removed index or on one that shifts down — resurrects a partial entry there, which then
   * keeps the deleted service in the generated SDL. Blurring the selection first unmounts every card so the
   * splice is clean; `flushSync` makes that unmount commit before the splice instead of batching with it.
   * Reselection is deliberately left to the consumer's reselect effect, which runs after the splice commits:
   * reselecting synchronously here would re-mount a card mid-splice and bring the ghost back. No-op passthrough
   * when there is no selection to manage (the splice is already safe).
   */
  const spliceServicesWithoutGhost = useCallback(
    (mutate: () => void) => {
      if (!onSelectService) {
        mutate();
        return;
      }
      flushSync(() => onSelectService(""));
      mutate();
    },
    [onSelectService]
  );

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
      spliceServicesWithoutGhost(() => {
        removeServicesAt(serviceIndexes);
        removePlacementsAt(placementIndex);
      });
    },
    [getValues, removeServicesAt, removePlacementsAt, spliceServicesWithoutGhost]
  );

  const addService = useCallback(
    (placementId: string) => {
      const service = newConfigureService(placementId, getValues());
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
      spliceServicesWithoutGhost(() => removeServicesAt(serviceRemovalIndexes(currentServices, index)));
    },
    [getValues, removeServicesAt, spliceServicesWithoutGhost]
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
 * Builds a fresh service for the configure screen: the shared default seeded onto the default (small)
 * hardware preset — so an added service opens deployable, matching the screen's first service — plus
 * the deployment-wide SSH key.
 */
function newConfigureService(placementId: string, values: SdlBuilderFormValuesType): ServiceType {
  const base = defaultService(placementId, { title: nextServiceTitle(values.services) });
  const seeded = { ...base, profile: applyPresetToProfile(base.profile, DEFAULT_HARDWARE_PRESET) };
  return withSeededSshKey(seeded, values);
}

/**
 * Seeds the deployment-wide SSH key onto a freshly added service so it isn't left
 * invalid while "Expose SSH" is on — the schema requires every service to carry
 * the key. No-op when SSH is off or no key has been set on any service yet.
 */
function withSeededSshKey(service: ServiceType, values: SdlBuilderFormValuesType): ServiceType {
  if (!values.hasSSHKey) {
    return service;
  }
  const key = values.services.map(readServiceSshKey).find(Boolean);
  return key ? withServiceSshKey(service, key) : service;
}
