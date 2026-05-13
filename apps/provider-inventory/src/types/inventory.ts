import type { ClusterState } from "./inventory.types";

export interface InventoryRollups {
  totalAvailableCpu: bigint;
  totalAvailableMemory: bigint;
  totalAvailableGpu: bigint;
  totalAvailableEph: bigint;
  totalAvailablePersistent: bigint;
  maxNodeFreeCpu: bigint;
  maxNodeFreeMemory: bigint;
  maxNodeFreeGpu: bigint;
  gpuModels: string[];
  storageClasses: string[];
}

export interface ProjectedRow extends InventoryRollups {
  cluster: ClusterState;
}
