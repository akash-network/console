import { availableCapacity } from "@src/domain/resource-pair/resource-pair";
import type { ClusterState } from "@src/types/inventory";

export function mapToStoredClusterState(cluster: ClusterState): StoredClusterState {
  let totalAvailableCpu = 0n;
  let totalAvailableMemory = 0n;
  let totalAvailableGpu = 0n;
  let totalAvailableEph = 0n;
  let totalAvailablePersistent = 0n;
  let maxNodeFreeCpu = 0n;
  let maxNodeFreeMemory = 0n;
  let maxNodeFreeGpu = 0n;
  const gpuModelSet = new Set<string>();
  const storageClassSet = new Set<string>();

  if (cluster.nodes) {
    for (const node of cluster.nodes) {
      const nodeCpu = availableCapacity(node.cpu);
      const nodeMemory = availableCapacity(node.memory);
      const nodeEph = availableCapacity(node.ephemeralStorage);
      const nodeGpu = availableCapacity(node.gpu.quantity);

      totalAvailableCpu += nodeCpu;
      totalAvailableMemory += nodeMemory;
      totalAvailableEph += nodeEph;
      totalAvailableGpu += nodeGpu;

      if (nodeCpu > maxNodeFreeCpu) maxNodeFreeCpu = nodeCpu;
      if (nodeMemory > maxNodeFreeMemory) maxNodeFreeMemory = nodeMemory;
      if (nodeGpu > maxNodeFreeGpu) maxNodeFreeGpu = nodeGpu;

      for (const gpu of node.gpu.info) {
        if (gpu.vendor && gpu.name) {
          gpuModelSet.add(`${gpu.vendor}/${gpu.name}`);
        }

        if (gpu.vendor) {
          gpuModelSet.add(gpu.vendor);
        }
      }

      for (const cls of node.storageClasses) {
        if (cls) storageClassSet.add(cls);
      }
    }
  }

  if (cluster.storage) {
    for (const pool of Object.values(cluster.storage)) {
      totalAvailablePersistent += availableCapacity(pool.quantity);
      if (pool.class) storageClassSet.add(pool.class);
    }
  }

  return {
    cluster,
    totalAvailableCpu,
    totalAvailableMemory,
    totalAvailableGpu,
    totalAvailableEph,
    totalAvailablePersistent,
    maxNodeFreeCpu,
    maxNodeFreeMemory,
    maxNodeFreeGpu,
    gpuModels: [...gpuModelSet].sort(),
    storageClasses: [...storageClassSet].sort()
  };
}

export interface StoredClusterState {
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
  cluster: ClusterState;
}
