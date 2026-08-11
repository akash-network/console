"use client";
import { useIsFetching } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { QueryKeys } from "@src/queries/queryKeys";

const startsWithPrefix = (key: readonly unknown[], prefix: readonly unknown[]) => prefix.length > 0 && prefix.every((part, index) => key[index] === part);

/**
 * True only when a billing query is refetching *while it already has data* (a background refresh),
 * so the page can show an unobtrusive top bar instead of swapping content for a skeleton and jumping.
 */
export function useBillingBackgroundLoading(): boolean {
  const { api } = useServices();
  const { address } = useWallet();

  const prefixes = [
    QueryKeys.getBalancesKey(address),
    QueryKeys.getAllLeasesKey(address),
    QueryKeys.getPaymentMethodsKey(),
    QueryKeys.getWeeklyDeploymentCostKey(),
    api.v1.getWalletSettings.getKey(),
    api.v1.getDefaultPaymentMethod.getKey(),
    api.v1.listStripeTransactions.getKey()
  ].filter(prefix => prefix.length > 0);

  const backgroundFetchingCount = useIsFetching({
    predicate: query => query.state.data !== undefined && prefixes.some(prefix => startsWithPrefix(query.queryKey as unknown[], prefix))
  });

  return backgroundFetchingCount > 0;
}
