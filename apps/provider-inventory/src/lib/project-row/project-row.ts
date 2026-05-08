import { computeRollups } from "@src/lib/compute-rollups/compute-rollups";
import type { Inventory, ProjectedRow } from "@src/types/inventory";
import type { StreamStatusMessage } from "@src/types/stream-status";

export function projectRow(message: StreamStatusMessage): ProjectedRow {
  const inventory: Inventory = {
    nodes: message.nodes.map(node => ({
      name: node.name,
      cpu: { available: BigInt(node.cpuAvailable) },
      memory: { available: BigInt(node.memoryAvailable) },
      gpu: node.gpus.map(g => ({
        vendor: g.vendor,
        model: g.model,
        available: BigInt(g.available)
      })),
      ephStorage: { available: BigInt(node.ephStorageAvailable) },
      persistentStorage: node.persistentStorage.map(ps => ({
        class: ps.class,
        available: BigInt(ps.available)
      }))
    })),
    storage: message.storage.map(s => ({
      class: s.class,
      available: BigInt(s.available)
    }))
  };

  const rollups = computeRollups(inventory);

  return { inventory, ...rollups };
}
