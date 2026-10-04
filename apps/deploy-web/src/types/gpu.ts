export interface GpuVendor {
  name: string;
  /** Branded vendor name for display (e.g. `NVIDIA`), provided by the API; absent on the hardcoded fallback. */
  displayName?: string;
  models: GpuModel[];
}

export interface GpuModel {
  name: string;
  /** Marketing-correct model name for display (e.g. `RTX 4090`), provided by the API; `name` stays the SDL value. */
  displayName?: string;
  memory: string[];
  interface: string[];
  /** Online providers with free capacity for the model, set only on models narrowed to what providers offer. */
  providerCount?: number;
  /** Free GPUs of the model across those providers, set only on models narrowed to what providers offer and served by the API. */
  availableUnits?: number;
  /** Most GPUs of the model a single node would bid on, set only on models narrowed to what providers offer and served by the API. */
  maxNodeFreeUnits?: number;
  /** Memory and interface combinations some provider would bid on, set only on models narrowed to what providers offer. */
  variants?: GpuVariant[];
}

export interface GpuVariant {
  memory: string | null;
  interface: string | null;
  providerCount: number;
  /** Absent on an API from before free GPUs were counted. */
  maxNodeFreeUnits?: number;
}

export interface ProviderGpuModelInventory {
  model: string;
  ram: string;
  interface: string;
  allocatable: number;
  allocated: number;
}

export interface ProviderGpuInventory {
  gpus: {
    total: { allocatable: number; allocated: number };
    details: Record<string, ProviderGpuModelInventory[]>;
  };
}
