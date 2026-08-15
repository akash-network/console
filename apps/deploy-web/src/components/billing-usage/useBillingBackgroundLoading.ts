"use client";
import { useIsFetching } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { QueryKeys } from "@src/queries/queryKeys";
import { LIVE_LEASE_STATES } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useServices, useWallet, useIsFetching };

const startsWithPrefix = (key: readonly unknown[], prefix: readonly unknown[]) => prefix.length > 0 && prefix.every((part, index) => key[index] === part);

const keysEqual = (key: readonly unknown[], other: readonly unknown[]) => key.length === other.length && startsWithPrefix(key, other);

/**
 * True only when a billing query is refetching *while it already has data* (a background refresh),
 * so the page can show an unobtrusive top bar instead of swapping content for a skeleton and jumping.
 *
 * `QueryKeys` entries are matched exactly: prefix matching would also catch derived keys such as the
 * app-wide lease-existence probe (`[...getAllLeasesKey, "EXISTENCE"]`), which is onboarding activity,
 * not billing. SDK keys are matched by prefix because their queries append the request input.
 */
export function useBillingBackgroundLoading(d: typeof DEPENDENCIES = DEPENDENCIES): boolean {
  const { api } = d.useServices();
  const { address } = d.useWallet();

  const exactKeys = [
    QueryKeys.getBalancesKey(address),
    QueryKeys.getAllLeasesKey(address),
    QueryKeys.getAllLeasesKey(address, LIVE_LEASE_STATES),
    QueryKeys.getPaymentMethodsKey(),
    QueryKeys.getWeeklyDeploymentCostKey()
  ].filter(key => key.length > 0);

  const prefixes = [api.v1.getWalletSettings.getKey(), api.v1.getDefaultPaymentMethod.getKey(), api.v1.listStripeTransactions.getKey()];

  const backgroundFetchingCount = d.useIsFetching({
    predicate: query =>
      query.state.data !== undefined &&
      (exactKeys.some(key => keysEqual(query.queryKey as unknown[], key)) || prefixes.some(prefix => startsWithPrefix(query.queryKey as unknown[], prefix)))
  });

  return backgroundFetchingCount > 0;
}
