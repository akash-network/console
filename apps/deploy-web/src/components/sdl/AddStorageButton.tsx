"use client";
import { Control, UseFieldArrayAppend } from "react-hook-form";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { NavArrowDown } from "iconoir-react";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPersistentStorage } from "@src/utils/sdl/data";
import { defaultRamStorage } from "../../utils/sdl/data";

type Props = {
  services: ServiceType[];
  serviceIndex: number;
  control: Control<SdlBuilderFormValuesType | RentGpusFormValuesType, any>;
  storageIndex: number;
  appendStorage: UseFieldArrayAppend<SdlBuilderFormValuesType, `services.${number}.profile.storage`>;
};

export const AddStorageButton: React.FunctionComponent<Props> = ({ services, serviceIndex, storageIndex, appendStorage }) => {
  const addPersistentStorage = () => {
    appendStorage(defaultPersistentStorage);
  };

  const addRamStorage = () => {
    appendStorage(defaultRamStorage);
  };

  const dropdownStyle = {
    borderLeft: "1px dashed rgba(255, 255, 255, 0.7)"
  };

  const serviceHasRamStorage = services[serviceIndex].profile.storage.some(storage => storage.type === "ram");

  return (
    <>
      {services[serviceIndex].profile.storage.length === storageIndex + 1 && (
        <div className="mt-2 flex items-center justify-end">
          <Button size="sm" className="rounded-l-md rounded-r-none" onClick={addPersistentStorage} type="button">
            Add Persistent Storage
          </Button>
          <DropdownMenu modal={true}>
            <DropdownMenuTrigger asChild>
              <Button size="sm" data-testid="deployment-detail-dropdown" className="rounded-l-none rounded-r-md px-2" style={dropdownStyle}>
                <NavArrowDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={serviceHasRamStorage} onClick={addRamStorage}>
                Add RAM Storage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={addPersistentStorage}>Add Persistent Storage</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );
};
