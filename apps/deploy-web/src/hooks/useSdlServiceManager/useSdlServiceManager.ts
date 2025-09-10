import { useCallback, useMemo } from "react";
import type { Control } from "react-hook-form";
import { useFieldArray, useWatch } from "react-hook-form";
import cloneDeep from "lodash/cloneDeep";
import { nanoid } from "nanoid";

import { findOwnLogCollectorServiceIndex, isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";

type Props = {
  control: Control<SdlBuilderFormValuesType>;
};

export const useSdlServiceManager = ({ control }: Props) => {
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

  const add = useCallback(() => {
    appendService({ ...cloneDeep(defaultService), id: nanoid(), title: calcNextServiceTitle() });
  }, [appendService, calcNextServiceTitle]);

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
