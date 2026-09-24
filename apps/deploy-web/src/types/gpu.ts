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
  /** Memory and interface combinations some provider would bid on, set only on models narrowed to what providers offer. */
  variants?: GpuVariant[];
}

export interface GpuVariant {
  memory: string | null;
  interface: string | null;
  providerCount: number;
}
