import { BmeSnapshots, BmeSnapshotsUrlParam, ProviderSnapshots, ProviderSnapshotsUrlParam, Snapshots, SnapshotsUrlParam } from "@/types";

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

const BME_SNAPSHOT_URL = {
  [BmeSnapshotsUrlParam.totalAktBurnedForAct]: BmeSnapshots.totalAktBurnedForAct,
  [BmeSnapshotsUrlParam.dailyAktBurnedForAct]: BmeSnapshots.dailyAktBurnedForAct,
  [BmeSnapshotsUrlParam.totalActMinted]: BmeSnapshots.totalActMinted,
  [BmeSnapshotsUrlParam.dailyActMinted]: BmeSnapshots.dailyActMinted,
  [BmeSnapshotsUrlParam.totalActBurnedForAkt]: BmeSnapshots.totalActBurnedForAkt,
  [BmeSnapshotsUrlParam.dailyActBurnedForAkt]: BmeSnapshots.dailyActBurnedForAkt,
  [BmeSnapshotsUrlParam.totalAktReminted]: BmeSnapshots.totalAktReminted,
  [BmeSnapshotsUrlParam.dailyAktReminted]: BmeSnapshots.dailyAktReminted,
  [BmeSnapshotsUrlParam.netAktBurned]: BmeSnapshots.netAktBurned,
  [BmeSnapshotsUrlParam.dailyNetAktBurned]: BmeSnapshots.dailyNetAktBurned,
  [BmeSnapshotsUrlParam.outstandingAct]: BmeSnapshots.outstandingAct,
  [BmeSnapshotsUrlParam.vaultAkt]: BmeSnapshots.vaultAkt,
  [BmeSnapshotsUrlParam.collateralRatio]: BmeSnapshots.collateralRatio
};

export const urlParamToBmeSnapshot = (snapshotsUrlParam: BmeSnapshotsUrlParam) => {
  return BME_SNAPSHOT_URL[snapshotsUrlParam] ?? NOT_FOUND;
};
