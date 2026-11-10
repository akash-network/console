export type GpuPriceStats = {
  currency: string;
  min: number;
  max: number;
  avg: number;
  weightedAverage: number;
  med: number;
};

export type GpuModelPrice = {
  vendor: string;
  model: string;
  ram: string;
  interface: string;
  availability: { total: number; available: number };
  providerAvailability: { total: number; available: number };
  price: GpuPriceStats | null;
};

export type GpuPricesResponse = {
  availability: { total: number; available: number };
  models: GpuModelPrice[];
};
