export enum Snapshots {
  activeLeaseCount = "activeLeaseCount",
  totalUAktSpent = "totalUAktSpent",
  totalUUsdcSpent = "totalUUsdcSpent",
  totalUUsdSpent = "totalUUsdSpent",
  totalLeaseCount = "totalLeaseCount",
  activeCPU = "activeCPU",
  activeGPU = "activeGPU",
  activeMemory = "activeMemory",
  activeStorage = "activeStorage",
  dailyUAktSpent = "dailyUAktSpent",
  dailyUUsdcSpent = "dailyUUsdcSpent",
  dailyUUsdSpent = "dailyUUsdSpent",
  dailyLeaseCount = "dailyLeaseCount"
}

export enum SnapshotsUrlParam {
  activeLeases = "active-leases",
  totalAKTSpent = "total-akt-spent",
  totalUSDCSpent = "total-usdc-spent",
  totalUSDSpent = "total-usd-spent",
  allTimeDeploymentCount = "all-time-deployment-count",
  compute = "compute",
  graphics = "graphics-gpu",
  memory = "memory",
  storage = "storage",
  dailyAktSpent = "daily-akt-spent",
  dailyUsdcSpent = "daily-usdc-spent",
  dailyUsdSpent = "daily-usd-spent",
  dailyDeploymentCount = "daily-deployment-count"
}

export enum BmeSnapshots {
  totalAktBurnedForAct = "totalAktBurnedForAct",
  dailyAktBurnedForAct = "dailyAktBurnedForAct",
  totalActMinted = "totalActMinted",
  dailyActMinted = "dailyActMinted",
  totalActBurnedForAkt = "totalActBurnedForAkt",
  dailyActBurnedForAkt = "dailyActBurnedForAkt",
  totalAktReminted = "totalAktReminted",
  dailyAktReminted = "dailyAktReminted",
  netAktBurned = "netAktBurned",
  dailyNetAktBurned = "dailyNetAktBurned",
  outstandingAct = "outstandingAct",
  vaultAkt = "vaultAkt",
  collateralRatio = "collateralRatio"
}

export enum BmeSnapshotsUrlParam {
  totalAktBurnedForAct = "total-akt-burned-for-act",
  dailyAktBurnedForAct = "daily-akt-burned-for-act",
  totalActMinted = "total-act-minted",
  dailyActMinted = "daily-act-minted",
  totalActBurnedForAkt = "total-act-burned-for-akt",
  dailyActBurnedForAkt = "daily-act-burned-for-akt",
  totalAktReminted = "total-akt-reminted",
  dailyAktReminted = "daily-akt-reminted",
  netAktBurned = "net-akt-burned",
  dailyNetAktBurned = "daily-net-akt-burned",
  outstandingAct = "outstanding-act",
  vaultAkt = "vault-akt",
  collateralRatio = "collateral-ratio"
}

export enum ProviderSnapshots {
  count = "count",
  cpu = "cpu",
  gpu = "gpu",
  memory = "memory",
  storage = "storage"
}

export enum ProviderSnapshotsUrlParam {
  count = "active-providers",
  cpu = "compute-cpu",
  gpu = "graphics-gpu",
  memory = "memory",
  storage = "storage"
}

export interface SnapshotValue {
  date: string;
  value: number;
}

export type GraphResponse = {
  snapshots: SnapshotValue[];
  currentValue: number;
  compareValue: number;
};

export type BmePeriodData = {
  date: string;
  outstandingAct: number;
  vaultAkt: number;
  collateralRatio: number;
  dailyAktBurnedForAct: number;
  totalAktBurnedForAct: number;
  dailyActMinted: number;
  totalActMinted: number;
  dailyActBurnedForAkt: number;
  totalActBurnedForAkt: number;
  dailyAktReminted: number;
  totalAktReminted: number;
  dailyNetAktBurned: number;
  netAktBurned: number;
};

export type BmeDashboardData = {
  now: BmePeriodData;
  compare: BmePeriodData;
};
