import type { MsgCreateBid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";

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
  hourlyPriceUakt: number;
  monthlyPriceUakt: number;
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
  data: MsgCreateBid;
};

export type GpuWithPricesType = GpuType & {
  prices: GpuBidType[];
};

export type ProviderWithBestBid = {
  provider: GpuProviderType;
  bestBid: GpuBidType;
};
