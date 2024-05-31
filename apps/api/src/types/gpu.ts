export interface GpuVendor {
  name: string;
  models: GpuModel[];
}

export interface GpuModel {
  name: string;
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