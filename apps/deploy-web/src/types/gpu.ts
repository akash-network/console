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
}
