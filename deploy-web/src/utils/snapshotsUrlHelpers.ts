import { ProviderSnapshots, ProviderSnapshotsUrlParam, Snapshots, SnapshotsUrlParam } from "@src/types/snapshots";

export const NOT_FOUND = "NOT_FOUND";

export const urlParamToSnapshot = (snapshotsUrlParam: SnapshotsUrlParam) => {
  switch (snapshotsUrlParam) {
    case SnapshotsUrlParam.activeDeployment:
      return Snapshots.activeLeaseCount;
    case SnapshotsUrlParam.allTimeDeploymentCount:
      return Snapshots.totalLeaseCount;
    case SnapshotsUrlParam.compute:
      return Snapshots.activeCPU;
    case SnapshotsUrlParam.graphics:
      return Snapshots.activeGPU;
    case SnapshotsUrlParam.memory:
      return Snapshots.activeMemory;
    case SnapshotsUrlParam.storage:
      return Snapshots.activeStorage;
    case SnapshotsUrlParam.totalAKTSpent:
      return Snapshots.totalUAktSpent;
    case SnapshotsUrlParam.dailyAktSpent:
      return Snapshots.dailyUAktSpent;
    case SnapshotsUrlParam.dailyDeploymentCount:
      return Snapshots.dailyLeaseCount;

    default:
      return NOT_FOUND;
  }
};

export const urlParamToProviderSnapshot = (snapshotsUrlParam: ProviderSnapshotsUrlParam) => {
  switch (snapshotsUrlParam) {
    case ProviderSnapshotsUrlParam.count:
      return ProviderSnapshots.count;
    case ProviderSnapshotsUrlParam.cpu:
      return ProviderSnapshots.cpu;
    case ProviderSnapshotsUrlParam.gpu:
      return ProviderSnapshots.gpu;
    case ProviderSnapshotsUrlParam.memory:
      return ProviderSnapshots.memory;
    case ProviderSnapshotsUrlParam.storage:
      return ProviderSnapshots.storage;

    default:
      return NOT_FOUND;
  }
};
