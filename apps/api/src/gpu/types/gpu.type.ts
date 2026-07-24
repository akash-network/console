export type GpuProviderType = {
  owner: string;
  hostUri: string;
  allocated: number;
  allocatable: number;
};

export type GpuType = {
  vendor: string;
  model: string;
  interface: string;
  ram: string;
  allocatable: number;
  allocated: number;
  providers: GpuProviderType[];
  availableProviders: GpuProviderType[];
};

export type GpuBidType = {
  height: number;
  txHash: string;
  datetime: Date;
  provider: string;
  aktTokenPrice: number;
  hourlyPrice: number;
  monthlyPrice: number;
  hourlyPriceUakt: number | null;
  monthlyPriceUakt: number | null;
  deployment: {
    owner: string;
    cpuUnits: number;
    memoryUnits: number;
    storageUnits: number;
    gpus: {
      vendor: string;
      model: string;
      ram: string;
      interface: string;
    }[];
  };
  /** JSON-encoded MsgCreateBid (v1beta4 or v1beta5), exposed only on debug requests; must stay JSON.stringify-safe. */
  data: unknown;
};

export type GpuWithPricesType = GpuType & {
  prices: GpuBidType[];
};

export type ProviderWithBestBid = {
  provider: GpuProviderType;
  bestBid: GpuBidType;
};

export type GpuPricingStats<T extends string> = {
  currency: T;
  min: number;
  max: number;
  avg: number;
  weightedAverage: number;
  med: number;
} | null;

export type GpuPriceModel = {
  vendor: string;
  model: string;
  ram: string;
  interface: string;
  availability: {
    total: number;
    available: number;
  };
  providerAvailability: {
    total: number;
    available: number;
    providers?: GpuProviderType[];
  };
  price: GpuPricingStats<"USD">;
  priceUakt: GpuPricingStats<"uakt">;
  bidCount?: number;
  providersWithBestBid?: ProviderWithBestBid[];
};
