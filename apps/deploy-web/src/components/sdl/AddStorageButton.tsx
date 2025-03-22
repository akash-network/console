"use client";
import { Control, UseFieldArrayAppend } from "react-hook-form";
import { Button } from "@akashnetwork/ui/components";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultMountedStorage } from "@src/utils/sdl/data";

type Props = {
  services: ServiceType[];
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  storageIndex: number;
  appendStorage: UseFieldArrayAppend<SdlBuilderFormValuesType, `services.${number}.profile.storage`>;
};

export const AddStorageButton: React.FunctionComponent<Props> = ({ services, serviceIndex, storageIndex, appendStorage }) => {
  const onAddStorage = () => {
    appendStorage(defaultMountedStorage);
  };

  return (
    <>
      {services[serviceIndex].profile.storage.length === storageIndex + 1 && (
        <div className="mt-2 flex items-center justify-end">
          <Button size="sm" onClick={onAddStorage} type="button">
            Add Storage
          </Button>
        </div>
      )}
    </>
  );
};
