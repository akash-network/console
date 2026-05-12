import type { Inventory, InventoryNode, InventoryNodeGpu, InventoryNodeStorage, ProjectedRow } from "@src/types/inventory";

export function projectedRowsEqual(a: ProjectedRow, b: ProjectedRow): boolean {
  if (a === b) return true;

  if (
    a.totalAvailableCpu !== b.totalAvailableCpu ||
    a.totalAvailableMemory !== b.totalAvailableMemory ||
    a.totalAvailableGpu !== b.totalAvailableGpu ||
    a.totalAvailableEph !== b.totalAvailableEph ||
    a.totalAvailablePersistent !== b.totalAvailablePersistent ||
    a.maxNodeFreeCpu !== b.maxNodeFreeCpu ||
    a.maxNodeFreeMemory !== b.maxNodeFreeMemory ||
    a.maxNodeFreeGpu !== b.maxNodeFreeGpu
  ) {
    return false;
  }

  if (!stringArrayEqual(a.gpuModels, b.gpuModels)) return false;
  if (!stringArrayEqual(a.storageClasses, b.storageClasses)) return false;

  return inventoryEqual(a.inventory, b.inventory);
}

function inventoryEqual(a: Inventory, b: Inventory): boolean {
  if (a === b) return true;
  return storageEqual(a.storage, b.storage) && nodesEqual(a.nodes, b.nodes);
}

function nodesEqual(a: readonly InventoryNode[], b: readonly InventoryNode[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  const byName = new Map<string, InventoryNode>();
  for (let i = 0; i < a.length; i++) {
    byName.set(a[i].name, a[i]);
  }
  for (let i = 0; i < b.length; i++) {
    const match = byName.get(b[i].name);
    if (!match || !nodeEqual(match, b[i])) return false;
  }
  return true;
}

function nodeEqual(a: InventoryNode, b: InventoryNode): boolean {
  if (a === b) return true;
  return (
    a.cpu.available === b.cpu.available &&
    a.memory.available === b.memory.available &&
    a.ephStorage.available === b.ephStorage.available &&
    gpuListEqual(a.gpu, b.gpu) &&
    storageEqual(a.persistentStorage, b.persistentStorage)
  );
}

function gpuListEqual(a: readonly InventoryNodeGpu[], b: readonly InventoryNodeGpu[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const match = b.find(g => g.vendor === a[i].vendor && g.model === a[i].model);
    if (!match || match.available !== a[i].available) return false;
  }
  return true;
}

function storageEqual(a: readonly InventoryNodeStorage[], b: readonly InventoryNodeStorage[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const match = b.find(s => s.class === a[i].class);
    if (!match || match.available !== a[i].available) return false;
  }
  return true;
}

function stringArrayEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!b.includes(a[i])) return false;
  }
  return true;
}
