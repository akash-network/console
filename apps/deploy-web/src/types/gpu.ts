export interface GpuVendor {
  name: string;
  models: GpuModel[];
}

export interface GpuModel {
  name: string;
  memory: string[];
  interface: string[];
}

export interface GpuPriceModel {
  vendor: string;
  model: string;
  ram: string;
  interface: string;
  availability: { total: number; available: number };
  providerAvailability: { total: number; available: number };
  price: { currency: string; min: number; max: number; avg: number; weightedAverage: number; med: number } | null;
}

export interface GpuPricesResponse {
  availability: { total: number; available: number };
  models: GpuPriceModel[];
}
