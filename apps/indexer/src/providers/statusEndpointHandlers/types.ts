export type ProviderStatusInfo = {
  resources: {
    deploymentCount: number;
    leaseCount: number;
    activeCPU: number;
    activeGPU: number;
    activeMemory: number;
    activeEphemeralStorage: number;
    activePersistentStorage: number;
    pendingCPU: number;
    pendingGPU: number;
    pendingMemory: number;
    pendingPersistentStorage: number;
    pendingEphemeralStorage: number;
    availableCPU: number;
    availableGPU: number;
    availableMemory: number;
    availablePersistentStorage: number;
    availableEphemeralStorage: number;
  };
  storage: {
    class: string;
    allocatable: number;
    allocated: number;
  }[];
  nodes: {
    name: string;
    cpuAllocatable: number;
    cpuAllocated: number;
    memoryAllocatable: number;
    memoryAllocated: number;
    ephemeralStorageAllocatable: number;
    ephemeralStorageAllocated: number;
    capabilitiesStorageHDD: boolean;
    capabilitiesStorageSSD: boolean;
    capabilitiesStorageNVME: boolean;
    gpuAllocatable: number;
    gpuAllocated: number;

    cpus: { vendor: string; model: string; vcores: number }[];
    gpus: { vendor: string; name: string; modelId: string; interface: string; memorySize: string }[];
  }[];
};

export type ProviderVersionEndpointResponseType =
  | {
      akash: { version: string; commit: string; buildTags: string; go: string; cosmosSdkVersion: string };
      kube: {
        major: string;
        minor: string;
        gitVersion: string;
        gitCommit: string;
        gitTreeState: string;
        buildDate: string;
        goVersion: string;
        compiler: string;
        platform: string;
      };
    }
  | {
      akash: {
        name: string;
        server_name: string;
        version: string;
        commit: string;
        build_tags: string;
        go: string;
        cosmos_sdk_version: string;
      };
      kube: {
        major: string;
        minor: string;
        gitVersion: string;
        gitCommit: string;
        gitTreeState: string;
        buildDate: string;
        goVersion: string;
        compiler: string;
        platform: string;
      };
    };
