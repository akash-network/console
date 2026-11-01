import type { NetworkId } from "@akashnetwork/chain-sdk/web";
import type { paths } from "@akashnetwork/console-api-types";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { UACT_DENOM, UAKT_DENOM, USDC_IBC_DENOMS } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import type { Balances } from "@src/types";
import { QueryKeys } from "./queryKeys";

type WalletBalances = paths["/v1/wallet-balances"]["get"]["responses"][200]["content"]["application/json"]["data"];
type Coin = WalletBalances["balances"][number];

export function useBalances(address?: string, options?: Omit<UseQueryOptions<Balances | null>, "queryKey" | "queryFn">) {
  const { api, networkStore } = useServices();

  return useQuery({
    queryKey: QueryKeys.getBalancesKey(address) as QueryKey,
    queryFn: async () => {
      const { data } = await api.v1.getWalletBalances.queryOptions().queryFn();
      return toBalances(data, USDC_IBC_DENOMS[networkStore.selectedNetworkId as NetworkId]);
    },
    ...options,
    enabled: options?.enabled !== false && !!address
  });
}

function toBalances(walletBalances: WalletBalances, usdcDenom: string | undefined): Balances {
  const balancesPerDenom = sumPerDenom(walletBalances.balances);
  const escrowPerDenom = sumPerDenom(walletBalances.activeDeployments.flatMap(({ escrow }) => escrow.funds));
  const grantsPerDenom = sumPerDenom(walletBalances.deploymentGrants);
  const amountOf = (perDenom: Map<string, number>, denom: string | undefined) => (denom ? perDenom.get(denom) ?? 0 : 0);

  return {
    balanceUAKT: amountOf(balancesPerDenom, UAKT_DENOM),
    balanceUUSDC: amountOf(balancesPerDenom, usdcDenom),
    balanceUACT: amountOf(balancesPerDenom, UACT_DENOM),
    deploymentEscrowUAKT: amountOf(escrowPerDenom, UAKT_DENOM),
    deploymentEscrowUUSDC: amountOf(escrowPerDenom, usdcDenom),
    deploymentEscrowUACT: amountOf(escrowPerDenom, UACT_DENOM),
    deploymentGrantsUAKT: amountOf(grantsPerDenom, UAKT_DENOM),
    deploymentGrantsUUSDC: amountOf(grantsPerDenom, usdcDenom),
    deploymentGrantsUACT: amountOf(grantsPerDenom, UACT_DENOM),
    activeDeployments: walletBalances.activeDeployments,
    deploymentGrants: walletBalances.deploymentGrants
  };
}

function sumPerDenom(coins: Coin[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const { denom, amount } of coins) {
    totals.set(denom, (totals.get(denom) ?? 0) + (parseFloat(amount) || 0));
  }

  return totals;
}
