import { QueryKey, useQuery, UseQueryOptions } from "react-query";
import axios from "axios";

import { UAKT_DENOM } from "@src/config/denom.config";
import { getUsdcDenom } from "@src/hooks/useDenom";
import { Balances } from "@src/types";
import { RestApiAuthzGrantsResponseType, RestApiBalancesResponseType } from "@src/types";
import { RpcDeployment } from "@src/types/deployment";
import { ApiUrlService, loadWithPagination } from "@src/utils/apiUtils";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

// Account balances
async function getBalances(apiEndpoint: string, address: string): Promise<Balances | undefined> {
  if (!address) return undefined;
  const usdcIbcDenom = getUsdcDenom();

  const balancePromise = axios.get<RestApiBalancesResponseType>(ApiUrlService.balance(apiEndpoint, address));
  const authzBalancePromise = axios.get<RestApiAuthzGrantsResponseType>(ApiUrlService.granteeGrants(apiEndpoint, address));
  const activeDeploymentsPromise = loadWithPagination<RpcDeployment[]>(ApiUrlService.deploymentList(apiEndpoint, address, true), "deployments", 1000);

  const [balanceResponse, authzBalanceResponse, activeDeploymentsResponse] = await Promise.all([balancePromise, authzBalancePromise, activeDeploymentsPromise]);

  // Authz Grants
  const deploymentGrants = authzBalanceResponse.data;
  const deploymentGrantsUAKT = deploymentGrants.grants.some(b => b.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization")
    ? parseFloat(deploymentGrants.grants.find(b => b.authorization.spend_limit.denom === UAKT_DENOM)?.authorization.spend_limit.amount || "0")
    : 0;
  const deploymentGrantsUUSDC = deploymentGrants.grants.some(b => b.authorization["@type"] === "/akash.deployment.v1beta3.DepositDeploymentAuthorization")
    ? parseFloat(deploymentGrants.grants.find(b => b.authorization.spend_limit.denom === usdcIbcDenom)?.authorization.spend_limit.amount || "0")
    : 0;

  // Balance
  const balanceData = balanceResponse.data;
  const balanceUAKT =
    balanceData.balances.some(b => b.denom === UAKT_DENOM) || deploymentGrantsUAKT > 0
      ? parseFloat(balanceData.balances.find(b => b.denom === UAKT_DENOM)?.amount || "0")
      : 0;
  const balanceUUSDC =
    balanceData.balances.some(b => b.denom === usdcIbcDenom) || deploymentGrantsUUSDC > 0
      ? parseFloat(balanceData.balances.find(b => b.denom === usdcIbcDenom)?.amount || "0")
      : 0;

  // Deployment balances
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
    deploymentGrants
  } as Balances;
}

export function useBalances(address: string, options?: Omit<UseQueryOptions<Balances, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getBalancesKey(address), () => getBalances(settings.apiEndpoint, address), options);
}
