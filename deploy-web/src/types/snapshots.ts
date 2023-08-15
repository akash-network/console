export enum Snapshots {
  activeLeaseCount = "activeLeaseCount",
  totalUAktSpent = "totalUAktSpent",
  totalLeaseCount = "totalLeaseCount",
  activeCPU = "activeCPU",
  activeGPU = "activeGPU",
  activeMemory = "activeMemory",
  activeStorage = "activeStorage",
  dailyUAktSpent = "dailyUAktSpent",
  dailyLeaseCount = "dailyLeaseCount"
}

export enum SnapshotsUrlParam {
  activeDeployment = "active-deployment",
  totalAKTSpent = "total-akt-spent",
  allTimeDeploymentCount = "all-time-deployment-count",
  compute = "compute",
  graphics = "graphics-gpu",
  memory = "memory",
  storage = "storage",
  dailyAktSpent = "daily-akt-spent",
  dailyDeploymentCount = "daily-deployment-count"
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
  value?: number;
}

export type GraphResponse = {
  snapshots: SnapshotValue[];
  currentValue: number;
  compareValue: number;
};
