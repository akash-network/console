export interface GpuVendor {
  name: string;
  models: GpuModel[];
}

export interface GpuModel {
  name: string;
  memory: string[];
  interface: string[];
}