import { useCallback, useMemo } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { nanoid } from "nanoid";

import { findOwnLogCollectorServiceIndex, isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";

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

  const { append: appendPlacement } = useFieldArray({
    control,
    name: "placements",
    keyName: "id"
  });

  const calcNextServiceTitle = useCallback(() => {
    const visibleServices = services.filter(service => !isLogCollectorService(service));
    const lastService = visibleServices[visibleServices.length - 1];
    const lastServiceIndex = lastService?.title?.match(/service-(\d+)/)?.[1];

    let nextIndex = lastServiceIndex ? parseInt(lastServiceIndex) + 1 : visibleServices.length + 1;
    let hasDuplicate = false;

    do {
      hasDuplicate = visibleServices.some(service => service.title === `service-${nextIndex}`);

      if (hasDuplicate) {
        nextIndex++;
      }
    } while (hasDuplicate);

    return `service-${nextIndex}`;
  }, [services]);

  const add = useCallback(() => {
    let placementId = placements[0]?.id;
    if (!placementId) {
      const placement = defaultPlacement();
      placementId = placement.id;
      appendPlacement(placement);
    }
    appendService({ ...defaultService(placementId), id: nanoid(), title: calcNextServiceTitle() });
  }, [appendService, appendPlacement, calcNextServiceTitle, placements]);

  const remove = useCallback(
    (index: number) => {
      const ownLogCollectorServiceIndex = findOwnLogCollectorServiceIndex(services[index], services);
      const indexes = (ownLogCollectorServiceIndex === -1 ? [index] : [index, ownLogCollectorServiceIndex]).sort((a, b) => b - a);
      removeService(indexes);
    },
    [services, removeService]
  );

  return useMemo(
    () => ({
      add,
      remove
    }),
    [add, remove]
  );
};
