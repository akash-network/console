export enum Snapshots {
  activeLeaseCount = "activeLeaseCount",
  totalUAktSpent = "totalUAktSpent",
  totalUActSpent = "totalUActSpent",
  totalUUsdSpent = "totalUUsdSpent",
  totalLeaseCount = "totalLeaseCount",
  activeCPU = "activeCPU",
  activeGPU = "activeGPU",
  activeMemory = "activeMemory",
  activeStorage = "activeStorage",
  dailyUAktSpent = "dailyUAktSpent",
  dailyUActSpent = "dailyUActSpent",
  dailyUUsdSpent = "dailyUUsdSpent",
  dailyLeaseCount = "dailyLeaseCount"
}

export enum SnapshotsUrlParam {
  activeLeases = "active-leases",
  totalAKTSpent = "total-akt-spent",
  totalACTSpent = "total-act-spent",
  totalUSDSpent = "total-usd-spent",
  allTimeDeploymentCount = "all-time-deployment-count",
  compute = "compute",
  graphics = "graphics-gpu",
  memory = "memory",
  storage = "storage",
  dailyAktSpent = "daily-akt-spent",
  dailyActSpent = "daily-act-spent",
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

export enum SinkSnapshots {
  mintedUakt = "sinkMintedUakt",
  dailyMintedUakt = "dailySinkMintedUakt",
  mintedTransfers = "sinkMintedTransfers",
  dailyMintedTransfers = "dailySinkMintedTransfers",
  pendingUakt = "sinkPendingUakt",
  voidedUakt = "sinkVoidedUakt",
  refundPendingUakt = "sinkRefundPendingUakt",
  refundedUakt = "sinkRefundedUakt"
}

export enum SinkSnapshotsUrlParam {
  mintedUakt = "akt-migrated",
  dailyMintedUakt = "daily-akt-migrated",
  mintedTransfers = "transfers",
  dailyMintedTransfers = "daily-transfers",
  pendingUakt = "akt-pending",
  voidedUakt = "akt-voided",
  refundPendingUakt = "akt-refund-pending",
  refundedUakt = "akt-refunded"
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

export type SinkPeriodData = {
  date: string;
  mintedUakt: number;
  dailyMintedUakt: number;
  mintedTransfers: number;
  dailyMintedTransfers: number;
  pendingUakt: number;
  pendingTransfers: number;
  voidedUakt: number;
  voidedTransfers: number;
  refundPendingUakt: number;
  refundPendingTransfers: number;
  refundedUakt: number;
  refundedTransfers: number;
};

export type SinkDashboardData = {
  now: SinkPeriodData;
  compare: SinkPeriodData;
};
