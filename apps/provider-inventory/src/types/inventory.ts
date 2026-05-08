export interface InventoryNodeGpu {
  vendor: string;
  model: string;
  available: number;
}

export interface InventoryNodeStorage {
  class: string;
  available: number;
}

export interface InventoryNode {
  name: string;
  cpu: { available: number };
  memory: { available: number };
  gpu: InventoryNodeGpu[];
  ephStorage: { available: number };
  persistentStorage: InventoryNodeStorage[];
}

export interface InventoryClusterStorage {
  class: string;
  available: number;
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
