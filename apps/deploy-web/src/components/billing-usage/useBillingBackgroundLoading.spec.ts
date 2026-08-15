import type { useIsFetching } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { QueryKeys } from "@src/queries/queryKeys";
import { LIVE_LEASE_STATES } from "@src/utils/reclamationUtils";
import type { DEPENDENCIES } from "./useBillingBackgroundLoading";
import { useBillingBackgroundLoading } from "./useBillingBackgroundLoading";

import { renderHook } from "@testing-library/react";

const ADDRESS = "akash1abc";

describe(useBillingBackgroundLoading.name, () => {
  it("counts a background refetch of the all-leases query", () => {
    const { isMatching } = setup();

    expect(isMatching(QueryKeys.getAllLeasesKey(ADDRESS), { hasData: true })).toBe(true);
  });

  it("counts a background refetch of the live-leases query used for billing spend", () => {
    const { isMatching } = setup();

    expect(isMatching(QueryKeys.getAllLeasesKey(ADDRESS, LIVE_LEASE_STATES), { hasData: true })).toBe(true);
  });

  it("ignores the lease-existence probe even though it extends the all-leases key", () => {
    const { isMatching } = setup();

    expect(isMatching(QueryKeys.getLeaseExistenceKey(ADDRESS), { hasData: true })).toBe(false);
  });

  it("ignores initial loads that have no data yet", () => {
    const { isMatching } = setup();

    expect(isMatching(QueryKeys.getAllLeasesKey(ADDRESS), { hasData: false })).toBe(false);
  });

  it("counts SDK queries by prefix since they append the request input to their key", () => {
    const { isMatching } = setup();

    expect(isMatching(["v1", "listStripeTransactions", { limit: 10 }], { hasData: true })).toBe(true);
  });

  it("ignores queries for other wallets", () => {
    const { isMatching } = setup();

    expect(isMatching(QueryKeys.getAllLeasesKey("akash1other"), { hasData: true })).toBe(false);
  });

  function setup() {
    let predicate: ((query: { queryKey: readonly unknown[]; state: { data: unknown } }) => boolean) | undefined;

    const dependencies = {
      useServices: () => ({
        api: {
          v1: {
            getWalletSettings: { getKey: () => ["v1", "getWalletSettings"] },
            getDefaultPaymentMethod: { getKey: () => ["v1", "getDefaultPaymentMethod"] },
            listStripeTransactions: { getKey: () => ["v1", "listStripeTransactions"] }
          }
        }
      }),
      useWallet: () => ({ address: ADDRESS }),
      useIsFetching: ((filters: { predicate: NonNullable<typeof predicate> }) => {
        predicate = filters.predicate;
        return 0;
      }) as unknown as typeof useIsFetching
    } as unknown as typeof DEPENDENCIES;

    renderHook(() => useBillingBackgroundLoading(dependencies));

    const isMatching = (queryKey: readonly unknown[], input: { hasData: boolean }) => predicate!({ queryKey, state: { data: input.hasData ? {} : undefined } });

    return { isMatching };
  }
});
