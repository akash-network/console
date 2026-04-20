import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { QueryKeys } from "@src/queries/queryKeys";
import { ApiUrlService } from "@src/utils/apiUtils";

type BidScreeningRequest = {
  data: {
    resources: Array<{
      cpu: number;
      memory: number;
      gpu: number;
      gpuAttributes?: { vendor: string; model?: string; interface?: string; memorySize?: string };
      ephemeralStorage: number;
      persistentStorage?: number;
      persistentStorageClass?: "beta1" | "beta2" | "beta3";
      count: number;
    }>;
    requirements: {
      attributes?: { key: string; value: string }[];
      signedBy?: { allOf?: string[]; anyOf?: string[] };
    };
    limit: number;
  };
};

export type BidScreeningProvider = {
  owner: string;
  hostUri: string;
  leaseCount: number;
  availableCpu: number;
  availableMemory: number;
  availableGpu: number;
  availableEphemeralStorage: number;
  availablePersistentStorage: number;
};

type BidScreeningConstraint = {
  name: string;
  count: number;
  actionableFeedback: string;
};

export type BidScreeningResponse = {
  data: {
    providers: BidScreeningProvider[];
    total: number;
    queryTimeMs: number;
    constraints?: BidScreeningConstraint[];
  };
};

export function useBidScreening(params: BidScreeningRequest | null) {
  const { publicConsoleApiHttpClient } = useServices();

  return useQuery({
    queryKey: QueryKeys.getBidScreeningKey(params),
    queryFn: async () => {
      const response = await publicConsoleApiHttpClient.post<BidScreeningResponse>(ApiUrlService.bidScreening(), params);
      return response.data.data;
    },
    enabled: !!params,
    staleTime: 30_000
  });
}
