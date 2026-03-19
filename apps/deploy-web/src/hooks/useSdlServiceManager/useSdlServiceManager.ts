import { useCallback, useMemo } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import { nanoid } from "nanoid";

import { findOwnLogCollectorServiceIndex, isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";
import type { SdlBuilderFormValuesType } from "@src/types";
import { getDefaultService } from "@src/utils/sdl/data";

export const DEPENDENCIES = {
  useSupportsACT
};

type Props = {
  control: Control<SdlBuilderFormValuesType>;
  dependencies?: typeof DEPENDENCIES;
};

export const useSdlServiceManager = ({ control, dependencies: d = DEPENDENCIES }: Props) => {
  const watchedServices = useWatch<SdlBuilderFormValuesType>({ control, name: "services", defaultValue: [] });
  const services = useMemo(() => (Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : []), [watchedServices]);

  const { remove: removeService, append: appendService } = useFieldArray({
    control,
    name: "services",
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

  const supportsACT = d.useSupportsACT();

  const add = useCallback(() => {
    appendService({ ...getDefaultService({ supportsACT }), id: nanoid(), title: calcNextServiceTitle() });
  }, [appendService, calcNextServiceTitle, supportsACT]);

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
