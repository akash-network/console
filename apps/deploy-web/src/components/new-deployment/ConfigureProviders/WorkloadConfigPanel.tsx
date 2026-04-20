"use client";
import type { FC } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { GpuPricesResponse } from "@src/types/gpu";
import type { PlacementFilters } from "@src/utils/sdlFormToBidScreeningRequest";
import { GpuCard } from "./cards/GpuCard";
import { ImageRuntimeCard } from "./cards/ImageRuntimeCard";
import { PlacementCard } from "./cards/PlacementCard";
import { ResourcesCard } from "./cards/ResourcesCard";

type Props = {
  control: Control<SdlBuilderFormValuesType>;
  currentService: ServiceType;
  services: ServiceType[];
  serviceIndex: number;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  gpuPrices: GpuPricesResponse | undefined;
  placementFilters: PlacementFilters;
  onPlacementChange: (filters: PlacementFilters) => void;
};

export const WorkloadConfigPanel: FC<Props> = ({
  control,
  currentService,
  services,
  serviceIndex,
  setValue,
  gpuPrices,
  placementFilters,
  onPlacementChange
}) => {
  return (
    <div className="space-y-3 p-3">
      <ImageRuntimeCard control={control} currentService={currentService} services={services} serviceIndex={serviceIndex} setValue={setValue} />
      <ResourcesCard control={control} currentService={currentService} serviceIndex={serviceIndex} />
      <GpuCard services={services} setValue={setValue} gpuPrices={gpuPrices} />
      <PlacementCard placementFilters={placementFilters} onPlacementChange={onPlacementChange} />
    </div>
  );
};
