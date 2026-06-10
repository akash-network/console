import { useCallback, useMemo } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { nanoid } from "nanoid";

import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import { nextServiceTitle, serviceRemovalIndexes } from "@src/utils/sdl/formArrayHelpers";

type Props = {
  control: Control<SdlBuilderFormValuesType>;
};

export const useSdlServiceManager = ({ control }: Props) => {
  const watchedServices = useWatch<SdlBuilderFormValuesType>({ control, name: "services", defaultValue: [] });
  const watchedPlacements = useWatch<SdlBuilderFormValuesType>({ control, name: "placements", defaultValue: [] });
  const services = useMemo(() => (Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : []), [watchedServices]);
  const placements = useMemo(
    () => (Array.isArray(watchedPlacements) ? (watchedPlacements as SdlBuilderFormValuesType["placements"]) : []),
    [watchedPlacements]
  );

  const { remove: removeService, append: appendService } = useFieldArray({
    control,
    name: "services",
    keyName: "id"
  });

  const { append: appendPlacement, remove: removePlacement } = useFieldArray({
    control,
    name: "placements",
    keyName: "id"
  });

  const add = useCallback(() => {
    const placement = defaultPlacement();
    appendPlacement(placement);
    appendService({ ...defaultService(placement.id), id: nanoid(), title: nextServiceTitle(services) });
  }, [appendService, appendPlacement, services]);

  const remove = useCallback(
    (index: number) => {
      const indexes = serviceRemovalIndexes(services, index);

      const removedPlacementIds = new Set(indexes.map(serviceIndex => services[serviceIndex]?.placementId));
      const remainingPlacementIds = new Set(services.filter((_, serviceIndex) => !indexes.includes(serviceIndex)).map(service => service.placementId));
      const orphanPlacementIndexes = placements
        .map((placement, placementIndex) => ({ placement, placementIndex }))
        .filter(({ placement }) => removedPlacementIds.has(placement.id) && !remainingPlacementIds.has(placement.id))
        .map(({ placementIndex }) => placementIndex)
        .sort((a, b) => b - a);

      removeService(indexes);
      if (orphanPlacementIndexes.length > 0) {
        removePlacement(orphanPlacementIndexes);
      }
    },
    [services, placements, removeService, removePlacement]
  );

  return useMemo(
    () => ({
      add,
      remove
    }),
    [add, remove]
  );
};
