import { bytesToShrink } from "./unitUtils";

import { ISnapshotMetadata, ProviderSnapshots } from "@/types";
import { NetworkCapacity } from "@/types";

export type LocalProviderData = {
  favorites: string[];
};

export function getNetworkCapacityDto(networkCapacity: NetworkCapacity) {
  return {
    ...networkCapacity,
    activeCPU: networkCapacity.activeCPU / 1000,
    pendingCPU: networkCapacity.pendingCPU / 1000,
    availableCPU: networkCapacity.availableCPU / 1000,
    totalCPU: networkCapacity.totalCPU / 1000
  };
}

export const getProviderSnapshotMetadata = (snapshot?: ProviderSnapshots): { unitFn: (number: number) => ISnapshotMetadata; legend?: string } => {
  switch (snapshot) {
    case ProviderSnapshots.cpu:
      return {
        unitFn: x => ({ value: x / 1000 })
      };
    case ProviderSnapshots.gpu:
      return {
        unitFn: x => ({ value: x })
      };
    case ProviderSnapshots.memory:
    case ProviderSnapshots.storage:
      return {
        unitFn: x => {
          const _ = bytesToShrink(x);
          return {
            value: x / 1000 / 1000 / 1000,
            unit: _.unit,
            modifiedValue: _.value
          };
        },
        legend: "GB"
      };

    default:
      return {
        unitFn: x => ({ value: x })
      };
  }
};

export const getProviderNameFromUri = (uri: string) => {
  const name = new URL(uri).hostname;
  return name;
};
