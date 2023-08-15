import { useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import axios from "axios";
import { useSettings } from "../context/SettingsProvider";
import { ApiUrlService } from "@src/utils/apiUtils";
import { Balances } from "@src/types";

// Account balances
async function getBalances(apiEndpoint: string, address: string): Promise<Balances> {
  if (!address) return {} as Balances;

  const balancePromise = axios.get(ApiUrlService.balance(apiEndpoint, address));
  const rewardsPromise = axios.get(ApiUrlService.rewards(apiEndpoint, address));
  const redelegationsPromise = axios.get(ApiUrlService.redelegations(apiEndpoint, address));
  const unbondingsPromise = axios.get(ApiUrlService.unbonding(apiEndpoint, address));

  const [balanceResponse, rewardsResponse, redelegationsResponse, unbondingsResponse] = await Promise.all([
    balancePromise,
    rewardsPromise,
    redelegationsPromise,
    unbondingsPromise
  ]);

  // Balance
  const balanceData = balanceResponse.data;
  const balance = balanceData.balances.some(b => b.denom === "uakt") ? parseInt(balanceData.balances.find(b => b.denom === "uakt").amount) : 0;

  // Rewards
  const rewardsData = rewardsResponse.data;
  const rewards = rewardsData.total.some(b => b.denom === "uakt") ? parseInt(rewardsData.total.find(b => b.denom === "uakt").amount) : 0;

  // Redelegations
  const redelegationsData = redelegationsResponse.data;
  const redelegations =
    redelegationsData.redelegation_responses.length > 0
      ? redelegationsData.redelegation_responses.map(x => x.entries.map(y => parseInt(y.balance)).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0)
      : 0;

  // Unbondings
  const unbondingsData = unbondingsResponse.data;
  const unbondings =
    unbondingsData.unbonding_responses.length > 0
      ? unbondingsData.unbonding_responses.map(x => x.entries.map(y => parseInt(y.balance)).reduce((a, b) => a + b, 0)).reduce((a, b) => a + b, 0)
      : 0;

  // Delegations
  let delegations = 0;
  // Delegations endpoint throws an error if there are no delegations
  try {
    const delegationsResponse = await axios.get(ApiUrlService.delegations(apiEndpoint, address));
    const delegationsData = delegationsResponse.data;

    delegations = delegationsData.delegation_responses.some(b => b.balance.denom === "uakt")
      ? delegationsData.delegation_responses
          .filter(x => x.balance.denom === "uakt")
          .map(x => parseInt(x.balance.amount))
          .reduce((a, b) => a + b, 0)
      : 0;
  } catch (error) {}

  return {
    balance,
    rewards,
    delegations,
    redelegations,
    unbondings
  } as Balances;
}

export function useBalances(address: string, options) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getBalancesKey(address), () => getBalances(settings.apiEndpoint, address), options);
}
