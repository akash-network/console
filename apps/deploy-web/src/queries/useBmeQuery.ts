import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { BmeParams, BmeStatus, RpcBmeParams, RpcBmeStatus } from "@src/types/bme";
import { ApiUrlService } from "@src/utils/apiUtils";
import { udenomToDenom } from "@src/utils/mathHelpers";
import { QueryKeys } from "./queryKeys";

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

async function getBmeParams(chainApiHttpClient: AxiosInstance): Promise<BmeParams> {
  const response = await chainApiHttpClient.get<RpcBmeParams>(ApiUrlService.bmeParams(""));
  const { params } = response.data;
  const minMintUact = parseInt(params.min_mint.amount, 10);
  return {
    minMintUact,
    minMintAct: udenomToDenom(minMintUact),
    mintSpreadBps: params.mint_spread_bps,
    settleSpreadBps: params.settle_spread_bps
  };
}

async function getBmeStatus(chainApiHttpClient: AxiosInstance): Promise<BmeStatus> {
  const response = await chainApiHttpClient.get<RpcBmeStatus>(ApiUrlService.bmeStatus(""));
  const { status } = response.data;
  return {
    mintsAllowed: status.mints_allowed,
    refundsAllowed: status.refunds_allowed,
    collateralRatio: parseFloat(status.collateral_ratio),
    circuitBreakerWarnThreshold: parseFloat(status.circuit_breaker_warn_threshold)
  };
}

export function useBmeParams(options?: Omit<UseQueryOptions<BmeParams>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getBmeParamsKey(),
    queryFn: () => getBmeParams(chainApiHttpClient),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
    ...options,
    enabled: options?.enabled !== false && !chainApiHttpClient.isFallbackEnabled
  });
}

export function useBmeStatus(options?: Omit<UseQueryOptions<BmeStatus>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getBmeStatusKey(),
    queryFn: () => getBmeStatus(chainApiHttpClient),
    staleTime: ONE_MINUTE_MS,
    refetchInterval: ONE_MINUTE_MS,
    ...options,
    enabled: options?.enabled !== false && !chainApiHttpClient.isFallbackEnabled
  });
}
