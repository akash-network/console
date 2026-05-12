export interface StreamStatusNodeGpu {
  vendor: string;
  model: string;
  available: number;
  memorySize: string;
  interface: string;
  modelId: string;
}

export interface StreamStatusNodeStorage {
  class: string;
  available: number;
}

export interface StreamStatusNode {
  name: string;
  cpuAvailable: number;
  memoryAvailable: number;
  gpus: StreamStatusNodeGpu[];
  ephStorageAvailable: number;
  persistentStorage: StreamStatusNodeStorage[];
}

export interface StreamStatusClusterStorage {
  class: string;
  available: number;
}

export interface StreamStatusMessage {
  nodes: StreamStatusNode[];
  storage: StreamStatusClusterStorage[];
}
