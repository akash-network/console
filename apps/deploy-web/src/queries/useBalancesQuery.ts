import { QueryKey, useQuery, UseQueryOptions } from "react-query";
import { AuthzHttpService } from "@akashnetwork/http-sdk";
import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { UAKT_DENOM } from "@src/config/denom.config";
import { getUsdcDenom } from "@src/hooks/useDenom";
import { Balances } from "@src/types";
import { RestApiBalancesResponseType } from "@src/types";
import { RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils"; // eslint-disable-line import-x/no-cycle
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

async function getBalances(apiEndpoint: string, address?: string): Promise<Balances | undefined> {
  if (!address || !apiEndpoint) return undefined;
  const usdcIbcDenom = getUsdcDenom();
  const authzHttpService = new AuthzHttpService({ baseURL: apiEndpoint });

  const [balanceResponse, deploymentGrant, activeDeploymentsResponse] = await Promise.all([
    axios.get<RestApiBalancesResponseType>(ApiUrlService.balance(apiEndpoint, address)),
    authzHttpService.getValidDepositDeploymentGrantsForGranterAndGrantee(browserEnvConfig.NEXT_PUBLIC_MASTER_WALLET_ADDRESS, address),
    loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList(apiEndpoint, address, true), "deployments", 1000)
  ]);

  const deploymentGrantsUAKT = parseFloat(
    deploymentGrant?.authorization.spend_limit.denom === UAKT_DENOM ? deploymentGrant.authorization.spend_limit.amount : "0"
  );

  const deploymentGrantsUUSDC = parseFloat(
    deploymentGrant && deploymentGrant.authorization.spend_limit.denom === usdcIbcDenom ? deploymentGrant.authorization.spend_limit.amount : "0"
  );

  const balanceData = balanceResponse.data;
  const balanceUAKT =
    balanceData.balances.some(b => b.denom === UAKT_DENOM) || deploymentGrantsUAKT > 0
      ? parseFloat(balanceData.balances.find(b => b.denom === UAKT_DENOM)?.amount || "0")
      : 0;
  const balanceUUSDC =
    balanceData.balances.some(b => b.denom === usdcIbcDenom) || deploymentGrantsUUSDC > 0
      ? parseFloat(balanceData.balances.find(b => b.denom === usdcIbcDenom)?.amount || "0")
      : 0;

  const activeDeployments = activeDeploymentsResponse.map(d => deploymentToDto(d));
  const aktActiveDeployments = activeDeployments.filter(d => d.denom === UAKT_DENOM);
  const usdcActiveDeployments = activeDeployments.filter(d => d.denom === usdcIbcDenom);
  const deploymentEscrowUAKT = aktActiveDeployments.reduce((acc, d) => acc + d.escrowBalance, 0);
  const deploymentEscrowUUSDC = usdcActiveDeployments.reduce((acc, d) => acc + d.escrowBalance, 0);

  return {
    balanceUAKT,
    balanceUUSDC,
    deploymentEscrowUAKT,
    deploymentEscrowUUSDC,
    deploymentGrantsUAKT,
    deploymentGrantsUUSDC,
    activeDeployments,
    deploymentGrant
  };
}

export function useBalances(address?: string, options?: Omit<UseQueryOptions<Balances | undefined>, "queryKey" | "queryFn">) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getBalancesKey(address) as QueryKey, () => getBalances(settings.apiEndpoint, address), {
    enabled: !!address,
    ...options
  });
}
