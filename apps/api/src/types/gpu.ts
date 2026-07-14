export interface GpuVendor {
  name: string;
  /** Branded vendor name for display (e.g. `NVIDIA`); `name` stays the canonical value. */
  displayName: string;
  models: GpuModel[];
}

export interface GpuModel {
  name: string;
  /** Marketing-correct model name for display (e.g. `RTX 4090`); `name` stays the canonical SDL/attribute value. */
  displayName: string;
  memory: string[];
  interface: string[];
}

export type ProviderConfigGpusType = {
  [key: string]: {
    name: string;
    devices: {
      [key: string]: {
        name: string;
        memory_size: string;
        interface: string;
      };
    };
  };
};
