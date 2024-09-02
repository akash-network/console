import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { getUsdcDenom } from "@src/hooks/useDenom";
import { Balances } from "@src/types";
import {
  RestApiBalancesResponseType,
  RestApiDelegationsType,
  RestApiRedelegationsResponseType,
  RestApiRewardsResponseType,
  RestApiUnbondingsResponseType
} from "@src/types/balances";
import { ApiUrlService } from "@src/utils/apiUtils";
import { uAktDenom } from "@src/utils/constants";
import { useSettings } from "../context/SettingsProvider";
import { QueryKeys } from "./queryKeys";

// Account balances
async function getBalances(apiEndpoint: string, address: string): Promise<Balances> {
  if (!address) return {} as Balances;
  const usdcIbcDenom = getUsdcDenom();

  const balancePromise = axios.get<RestApiBalancesResponseType>(ApiUrlService.balance(apiEndpoint, address));
  const rewardsPromise = axios.get<RestApiRewardsResponseType>(ApiUrlService.rewards(apiEndpoint, address));
  const redelegationsPromise = axios.get<RestApiRedelegationsResponseType>(ApiUrlService.redelegations(apiEndpoint, address));
  const unbondingsPromise = axios.get<RestApiUnbondingsResponseType>(ApiUrlService.unbonding(apiEndpoint, address));

  const [balanceResponse, rewardsResponse, redelegationsResponse, unbondingsResponse] = await Promise.all([
    balancePromise,
    rewardsPromise,
    redelegationsPromise,
    unbondingsPromise
  ]);

  // Balance
  const balanceData = balanceResponse.data;
  const balance = balanceData.balances.some(b => b.denom === uAktDenom) ? parseFloat(balanceData.balances.find(b => b.denom === uAktDenom)?.amount || "0") : 0;
  const balanceUsdc = balanceData.balances.some(b => b.denom === usdcIbcDenom)
    ? parseFloat(balanceData.balances.find(b => b.denom === usdcIbcDenom)?.amount || "0")
    : 0;

  // Rewards
  const rewardsData = rewardsResponse.data;
  const rewards = rewardsData.total.some(b => b.denom === uAktDenom) ? parseFloat(rewardsData.total.find(b => b.denom === uAktDenom)?.amount || "0") : 0;

  // Redelegations
  const redelegationsData = redelegationsResponse.data;
  const redelegations =
    redelegationsData.redelegation_responses.length > 0
      ? redelegationsData.redelegation_responses.map(x => x.entries.map(y => parseFloat(y.balance)).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0)
      : 0;

  // Unbondings
  const unbondingsData = unbondingsResponse.data;
  const unbondings =
    unbondingsData.unbonding_responses.length > 0
      ? unbondingsData.unbonding_responses.map(x => x.entries.map(y => parseFloat(y.balance)).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0)
      : 0;

  // Delegations
  let delegations = 0;
  // Delegations endpoint throws an error if there are no delegations
  try {
    const delegationsResponse = await axios.get<RestApiDelegationsType>(ApiUrlService.delegations(apiEndpoint, address));
    const delegationsData = delegationsResponse.data;

    delegations = delegationsData.delegation_responses.some(b => b.balance.denom === uAktDenom)
      ? delegationsData.delegation_responses
          .filter(x => x.balance.denom === uAktDenom)
          .map(x => parseFloat(x.balance.amount))
          .reduce((a, b) => a + b, 0)
      : 0;
  } catch (error) {
    /* empty */
  }

  return {
    balance,
    balanceUsdc,
    rewards,
    delegations,
    redelegations,
    unbondings
  } as Balances;
}

export function useBalances(address: string, options) {
  const { settings } = useSettings();
  return useQuery({
    queryKey: QueryKeys.getBalancesKey(address),
    queryFn: () => getBalances(settings.apiEndpoint, address),
    ...options,
  });
}