export interface InventoryNodeGpu {
  vendor: string;
  model: string;
  available: bigint;
}

export interface InventoryNodeStorage {
  class: string;
  available: bigint;
}

export interface InventoryNode {
  name: string;
  cpu: { available: bigint };
  memory: { available: bigint };
  gpu: InventoryNodeGpu[];
  ephStorage: { available: bigint };
  persistentStorage: InventoryNodeStorage[];
}

export interface InventoryClusterStorage {
  class: string;
  available: bigint;
}

export interface Inventory {
  nodes: InventoryNode[];
  storage: InventoryClusterStorage[];
}

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
  inventory: Inventory;
}

export interface ReducedAttributes {
  selfAttributes: Array<{ key: string; value: string }>;
  signedAttributes: Array<{ key: string; value: string; auditor: string }>;
  auditedBy: string[];
}
