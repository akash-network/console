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
    const nodeCpu = clamp(node.cpu.available);
    const nodeMemory = clamp(node.memory.available);
    const nodeEph = clamp(node.ephStorage.available);

    totalAvailableCpu += nodeCpu;
    totalAvailableMemory += nodeMemory;
    totalAvailableEph += nodeEph;

    if (nodeCpu > maxNodeFreeCpu) maxNodeFreeCpu = nodeCpu;
    if (nodeMemory > maxNodeFreeMemory) maxNodeFreeMemory = nodeMemory;

    let nodeGpuTotal = 0n;
    for (const gpu of node.gpu) {
      const gpuCount = clamp(gpu.available);
      nodeGpuTotal += gpuCount;
      totalAvailableGpu += gpuCount;
      if (gpu.vendor && gpu.model) {
        gpuModelSet.add(`${gpu.vendor}/${gpu.model}`);
      }
    }
    if (nodeGpuTotal > maxNodeFreeGpu) maxNodeFreeGpu = nodeGpuTotal;

    for (const ps of node.persistentStorage) {
      totalAvailablePersistent += clamp(ps.available);
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

function clamp(value: number): bigint {
  return value < 0 ? 0n : BigInt(value);
}
