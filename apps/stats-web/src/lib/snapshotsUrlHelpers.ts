import { ProviderSnapshots, ProviderSnapshotsUrlParam, Snapshots, SnapshotsUrlParam } from "@/types";

export type SNAPSHOT_NOT_FOUND = "NOT_FOUND";
export const NOT_FOUND: SNAPSHOT_NOT_FOUND = "NOT_FOUND";

const SNAPSHOT_URL = {
  [SnapshotsUrlParam.activeLeases]: Snapshots.activeLeaseCount,
  [SnapshotsUrlParam.allTimeDeploymentCount]: Snapshots.totalLeaseCount,
  [SnapshotsUrlParam.compute]: Snapshots.activeCPU,
  [SnapshotsUrlParam.graphics]: Snapshots.activeGPU,
  [SnapshotsUrlParam.memory]: Snapshots.activeMemory,
  [SnapshotsUrlParam.storage]: Snapshots.activeStorage,
  [SnapshotsUrlParam.totalAKTSpent]: Snapshots.totalUAktSpent,
  [SnapshotsUrlParam.totalUSDCSpent]: Snapshots.totalUUsdcSpent,
  [SnapshotsUrlParam.totalUSDSpent]: Snapshots.totalUUsdSpent,
  [SnapshotsUrlParam.dailyAktSpent]: Snapshots.dailyUAktSpent,
  [SnapshotsUrlParam.dailyUsdcSpent]: Snapshots.dailyUUsdcSpent,
  [SnapshotsUrlParam.dailyUsdSpent]: Snapshots.dailyUUsdSpent,
  [SnapshotsUrlParam.dailyDeploymentCount]: Snapshots.dailyLeaseCount
};

export const urlParamToSnapshot = (snapshotsUrlParam: SnapshotsUrlParam) => {
  return SNAPSHOT_URL[snapshotsUrlParam] ?? NOT_FOUND;
};

export const urlParamToProviderSnapshot = (snapshotsUrlParam: ProviderSnapshotsUrlParam) => {
  const snapshotUrlMapping = {
    [ProviderSnapshotsUrlParam.count]: ProviderSnapshots.count,
    [ProviderSnapshotsUrlParam.cpu]: ProviderSnapshots.cpu,
    [ProviderSnapshotsUrlParam.gpu]: ProviderSnapshots.gpu,
    [ProviderSnapshotsUrlParam.memory]: ProviderSnapshots.memory,
    [ProviderSnapshotsUrlParam.storage]: ProviderSnapshots.storage
  };

  return snapshotUrlMapping[snapshotsUrlParam] ?? NOT_FOUND;
};
