export interface ProviderWithSnapshot {
  owner: string;
  hostUri: string;
  ipRegion: string | null;
  uptime7d: number | null;
  lastSuccessfulSnapshot: {
    nodes: {
      name: string;
      cpuAllocatable: number;
      cpuAllocated: number;
      memoryAllocatable: number;
      memoryAllocated: number;
      ephemeralStorageAllocatable: number;
      ephemeralStorageAllocated: number;
      gpuAllocatable: number;
      gpuAllocated: number;
      capabilitiesStorageHDD: boolean;
      capabilitiesStorageSSD: boolean;
      capabilitiesStorageNVME: boolean;
      gpus: {
        vendor: string;
        name: string;
        modelId: string;
        interface: string;
        memorySize: string;
      }[];
      cpus: {
        vendor: string;
        model: string;
        vcores: number;
      }[];
    }[];
    storage: {
      class: string;
      allocatable: number;
      allocated: number;
    }[];
  };
}
