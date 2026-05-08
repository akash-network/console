import type { Inventory, InventoryRollups } from "@src/types/inventory";

export function computeRollups(inventory: Inventory): InventoryRollups {
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

  for (const node of inventory.nodes) {
    const nodeCpu = clampBigInt(node.cpu.available);
    const nodeMemory = clampBigInt(node.memory.available);
    const nodeEph = clampBigInt(node.ephStorage.available);

    totalAvailableCpu += nodeCpu;
    totalAvailableMemory += nodeMemory;
    totalAvailableEph += nodeEph;

    if (nodeCpu > maxNodeFreeCpu) maxNodeFreeCpu = nodeCpu;
    if (nodeMemory > maxNodeFreeMemory) maxNodeFreeMemory = nodeMemory;

    let nodeGpuTotal = 0n;
    for (const gpu of node.gpu) {
      const gpuCount = clampBigInt(gpu.available);
      nodeGpuTotal += gpuCount;
      totalAvailableGpu += gpuCount;
      if (gpu.vendor && gpu.model) {
        gpuModelSet.add(`${gpu.vendor}/${gpu.model}`);
      }
    }
    if (nodeGpuTotal > maxNodeFreeGpu) maxNodeFreeGpu = nodeGpuTotal;

    for (const ps of node.persistentStorage) {
      totalAvailablePersistent += clampBigInt(ps.available);
      if (ps.class) storageClassSet.add(ps.class);
    }
  }

  for (const s of inventory.storage) {
    if (s.class) storageClassSet.add(s.class);
  }

  return {
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

function clampBigInt(value: number): bigint {
  return BigInt(Math.max(0, value));
}
