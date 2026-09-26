"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useWallet } from "@src/context/WalletProvider";
import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import type { ProviderSearchSort } from "@src/queries/useProvidersQuery";
import { useNetworkCapacity, useProviderLocations, useProviderSearch } from "@src/queries/useProvidersQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList, ClientProviderList } from "@src/types/provider";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { UrlService } from "@src/utils/urlUtils";

export type SortId = "active-leases-desc" | "active-leases-asc" | "my-leases-desc" | "my-active-leases-desc" | "gpu-available-desc";

export const SORT_OPTIONS: { id: SortId; title: string }[] = [
  { id: "active-leases-desc", title: "Active Leases (desc)" },
  { id: "active-leases-asc", title: "Active Leases (asc)" },
  { id: "my-leases-desc", title: "Your Leases (desc)" },
  { id: "my-active-leases-desc", title: "Your Active Leases (desc)" },
  { id: "gpu-available-desc", title: "GPUs Available (desc)" }
];

const DEFAULT_SORT: SortId = "active-leases-desc";

const WALLET_SORT_IDS: readonly SortId[] = ["my-leases-desc", "my-active-leases-desc"];

const SEARCH_SORTS: Record<SortId, ProviderSearchSort> = {
  "active-leases-desc": "active-leases-desc",
  "active-leases-asc": "active-leases-asc",
  "my-leases-desc": "wallet-leases-desc",
  "my-active-leases-desc": "wallet-active-leases-desc",
  "gpu-available-desc": "gpus-desc"
};

export const DEFAULT_PAGE_SIZE = 10;

/** The provider search refuses a request naming more addresses than this. */
export const MAX_SEARCHED_FAVORITES = 100;

const SEARCH_PACING = { wait: 400, maxWait: 1000 };

export const DEPENDENCIES = {
  useWallet,
  useLocalNotes,
  useRouter,
  useSearchParams,
  useProviderSearch,
  useProviderLocations,
  useNetworkCapacity,
  useAllLeases
};

export function useProviderListModel(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { address } = d.useWallet();
  const { favoriteProviders } = d.useLocalNotes();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isFilteringActive, setIsFilteringActive] = useState(true);
  const [isFilteringAudited, setIsFilteringAudited] = useState(true);
  const [isFilteringFavorites, setIsFilteringFavorites] = useState(false);
  const [search, setSearch] = useState("");
  const pacedSearch = usePacedValue(search.trim(), SEARCH_PACING);

  const hasWallet = !!address;
  const sort = resolveSort(searchParams?.get("sort"), hasWallet);
  const hasNoFavoriteToShow = isFilteringFavorites && favoriteProviders.length === 0;

  const providerSearch = d.useProviderSearch(
    {
      search: pacedSearch || undefined,
      online: isFilteringActive || undefined,
      audited: isFilteringAudited || undefined,
      addresses: isFilteringFavorites ? favoriteProviders.slice(0, MAX_SEARCHED_FAVORITES) : undefined,
      sort: SEARCH_SORTS[sort],
      walletAddress: WALLET_SORT_IDS.includes(sort) ? address : undefined,
      skip: pageIndex * pageSize,
      limit: pageSize
    },
    { enabled: !hasNoFavoriteToShow }
  );
  const providerLocations = d.useProviderLocations();
  const { data: networkCapacity, isFetching: isLoadingNetworkCapacity } = d.useNetworkCapacity();
  const { data: leases, isFetching: isLoadingLeases, refetch: getLeases } = d.useAllLeases(address, { enabled: false });

  useEffect(
    function loadWalletLeases() {
      getLeases();
    },
    [getLeases]
  );

  const providers = useMemo(
    () => (hasNoFavoriteToShow ? [] : (providerSearch.data?.providers ?? []).map(provider => withWalletLeaseCounts(provider, leases))),
    [hasNoFavoriteToShow, providerSearch.data, leases]
  );
  const matchingProviderCount = hasNoFavoriteToShow ? 0 : providerSearch.data?.pagination.total ?? 0;

  const changeSort = useCallback(
    (value: string) => {
      setPageIndex(0);
      router.replace(UrlService.providers(value), { scroll: false });
    },
    [router]
  );

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPageIndex(0);
  }, []);

  const changeIsFilteringActive = useCallback((value: boolean) => {
    setIsFilteringActive(value);
    setPageIndex(0);
  }, []);

  const changeIsFilteringAudited = useCallback((value: boolean) => {
    setIsFilteringAudited(value);
    setPageIndex(0);
  }, []);

  const changeIsFilteringFavorites = useCallback((value: boolean) => {
    setIsFilteringFavorites(value);
    setPageIndex(0);
  }, []);

  const changePageSize = useCallback((value: number) => {
    setPageSize(value);
    setPageIndex(0);
  }, []);

  const { refetch: refetchProviders } = providerSearch;
  const { refetch: refetchLocations } = providerLocations;
  const refresh = useCallback(() => {
    refetchProviders();
    refetchLocations();
  }, [refetchProviders, refetchLocations]);

  return {
    sort,
    sortOptions: hasWallet ? SORT_OPTIONS : SORT_OPTIONS.filter(option => !WALLET_SORT_IDS.includes(option.id)),
    changeSort,
    search,
    changeSearch,
    isFilteringActive,
    changeIsFilteringActive,
    isFilteringAudited,
    changeIsFilteringAudited,
    isFilteringFavorites,
    changeIsFilteringFavorites,
    pageIndex,
    changePageIndex: setPageIndex,
    pageSize,
    changePageSize,
    pageCount: Math.ceil(matchingProviderCount / pageSize),
    providers,
    hasLoadedProviders: !!providerSearch.data || hasNoFavoriteToShow,
    isLoadingProviders: providerSearch.isFetching,
    locations: providerLocations.data,
    networkCapacity,
    isLoading: providerSearch.isFetching || providerLocations.isFetching || isLoadingLeases || isLoadingNetworkCapacity,
    refresh
  };
}

function resolveSort(requested: string | null | undefined, hasWallet: boolean): SortId {
  const option = SORT_OPTIONS.find(({ id }) => id === requested);

  if (!option || (WALLET_SORT_IDS.includes(option.id) && !hasWallet)) {
    return DEFAULT_SORT;
  }

  return option.id;
}

function withWalletLeaseCounts(provider: ApiProviderList, leases: LeaseDto[] | null | undefined): ClientProviderList {
  const providerLeases = leases?.filter(lease => lease.provider === provider.owner) ?? [];

  return { ...provider, userLeases: providerLeases.length, userActiveLeases: providerLeases.filter(isLeaseLive).length };
}
