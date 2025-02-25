export interface ProviderPricingResponse {
  message: string;
  pricing: {
    price_target_cpu: number;
    price_target_memory: number;
    price_target_hd_ephemeral: number;
    price_target_gpu_mappings: string;
    price_target_endpoint: number;
    price_target_hd_pers_hdd: number;
    price_target_hd_pers_nvme: number;
    price_target_hd_pers_ssd: number;
    price_target_ip: number;
  };
}

export interface GpuPriceData {
  vendor: string;
  model: string;
  ram: string;
  interface: string;
  price: {
    currency: string;
    min: number;
    max: number;
    avg: number;
    weightedAverage: number;
    med: number;
  };
}

export interface GpuPricesResponse {
  availability: {
    total: number;
    available: number;
  };
  models: GpuPriceData[];
}
