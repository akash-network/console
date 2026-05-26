import type { ProjectedRow } from "@src/types/inventory";
import type { ClusterState } from "@src/types/inventory.types";

export function projectRow(cluster: ClusterState): ProjectedRow {
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

  for (const node of cluster.nodes) {
    const nodeCpu = node.cpu.available();
    const nodeMemory = node.memory.available();
    const nodeEph = node.ephemeralStorage.available();
    const nodeGpu = node.gpu.quantity.available();

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

  for (const pool of Object.values(cluster.storage)) {
    totalAvailablePersistent += pool.quantity.available();
    if (pool.class) storageClassSet.add(pool.class);
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
