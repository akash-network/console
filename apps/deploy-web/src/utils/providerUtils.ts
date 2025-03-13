import networkStore from "@src/store/networkStore";
import { ISnapshotMetadata, ProviderSnapshots } from "@src/types";
import { ProviderStatus, ProviderStatusDto, ProviderVersion } from "@src/types/provider";
import { bytesToShrink } from "./unitUtils";

export type LocalProviderData = {
  favorites: string[];
};

export function providerStatusToDto(providerStatus: ProviderStatus, providerVersion: ProviderVersion): ProviderStatusDto {
  return {
    name: providerStatus.cluster_public_hostname,
    orderCount: providerStatus.bidengine.orders,
    deploymentCount: providerStatus.manifest.deployments,
    leaseCount: providerStatus.cluster.leases,
    active: providerStatus.cluster.inventory.active,
    available: providerStatus.cluster.inventory.available,
    pending: providerStatus.cluster.inventory.pending,
    error: providerStatus.cluster.inventory.error,
    akash: providerVersion.akash,
    kube: providerVersion.kube
  };
}

export function getNetworkCapacityDto(networkCapacity: any) {
  return {
    ...networkCapacity,
    activeCPU: networkCapacity.activeCPU / 1000,
    pendingCPU: networkCapacity.pendingCPU / 1000,
    availableCPU: networkCapacity.availableCPU / 1000,
    totalCPU: networkCapacity.totalCPU / 1000
  };
}

export function getProviderLocalData(): LocalProviderData {
  const dataStr = localStorage.getItem(`${networkStore.selectedNetworkId}/provider.data`);
  if (!dataStr) {
    return { favorites: [] };
  }

  const parsedData = JSON.parse(dataStr) as LocalProviderData;

  return parsedData;
}

export function updateProviderLocalData(data: LocalProviderData) {
  const oldData = getProviderLocalData();
  const newData = { ...oldData, ...data };

  localStorage.setItem(`${networkStore.selectedNetworkId}/provider.data`, JSON.stringify(newData));
}

export const getSnapshotMetadata = (snapshot?: ProviderSnapshots): { unitFn: (number: number) => ISnapshotMetadata; legend?: string } => {
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
