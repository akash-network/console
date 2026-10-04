"use client";
import { useCallback, useMemo, useState } from "react";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { totalOf } from "@src/components/providers/providerSummary/providerSummary";
import { usePacedValue } from "@src/hooks/usePacedValue/usePacedValue";
import { useDashboardData, useProviderLocations, useProviderSearch } from "@src/queries/useProvidersQuery";
import type { ApiProviderLocation } from "@src/types/provider";

export type ProviderFilters = {
  regions: string[];
  gpuModels: string[];
  isGpuOnly: boolean;
  isActiveOnly: boolean;
  isAuditedOnly: boolean;
  isFavoritesOnly: boolean;
};

export type FilterOption = { value: string; count: number };

export type NetworkStats = {
  availableGpuCount: number | null;
  activeProviderCount: number | null;
  availableVcpuCount: number | null;
  activeLeaseCount: number | null;
  averageUptime30d: number | null;
};

export const PAGE_SIZE = 10;

/** The provider search refuses a request naming more addresses than this. */
export const MAX_SEARCHED_FAVORITES = 100;

/** The provider search refuses a longer search than this. */
export const MAX_SEARCH_LENGTH = 200;

export const DEFAULT_FILTERS: ProviderFilters = {
  regions: [],
  gpuModels: [],
  isGpuOnly: false,
  isActiveOnly: true,
  isAuditedOnly: true,
  isFavoritesOnly: false
};

const SEARCH_PACING = { wait: 400, maxWait: 1000 };
const HIGH_SURROGATE_AT_END = /[\uD800-\uDBFF]$/;
const MILLICORES_PER_VCPU = 1000;

export const DEPENDENCIES = {
  useLocalNotes,
  useProviderSearch,
  useProviderLocations,
  useDashboardData
};

export function useProvidersExplorerModel(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const d = dependencies;
  const { favoriteProviders, updateFavoriteProviders } = d.useLocalNotes();
  const [filters, setFilters] = useState<ProviderFilters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const pacedSearch = usePacedValue(capSearchLength(search.trim()), SEARCH_PACING);
  const hasNoFavoriteToShow = filters.isFavoritesOnly && favoriteProviders.length === 0;

  const providerSearch = d.useProviderSearch(
    {
      search: pacedSearch || undefined,
      online: filters.isActiveOnly || undefined,
      audited: filters.isAuditedOnly || undefined,
      addresses: filters.isFavoritesOnly ? favoriteProviders.slice(0, MAX_SEARCHED_FAVORITES) : undefined,
      regions: filters.regions.length > 0 ? filters.regions : undefined,
      gpu: filters.isGpuOnly || undefined,
      gpuModels: filters.gpuModels.length > 0 ? filters.gpuModels : undefined,
      sort: "active-leases-desc",
      skip: pageIndex * PAGE_SIZE,
      limit: PAGE_SIZE
    },
    { enabled: !hasNoFavoriteToShow }
  );
  const providerLocations = d.useProviderLocations();
  const dashboard = d.useDashboardData();

  const providers = useMemo(() => (hasNoFavoriteToShow ? [] : providerSearch.data?.providers ?? []), [hasNoFavoriteToShow, providerSearch.data]);
  const matchingProviderCount = hasNoFavoriteToShow ? 0 : providerSearch.data?.pagination.total ?? 0;
  const hasLoadedProviders = !!providerSearch.data || hasNoFavoriteToShow;
  const isSearchingProviders = providerSearch.isFetching || providerSearch.isPaused;
  const locations = useMemo(() => providerLocations.data ?? [], [providerLocations.data]);

  const updateFilters = useCallback((change: Partial<ProviderFilters>) => {
    setFilters(current => ({ ...current, ...change }));
    setPageIndex(0);
  }, []);

  const changeSearch = useCallback((value: string) => {
    setSearch(value);
    setPageIndex(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
    setPageIndex(0);
  }, []);

  const toggleFavorite = useCallback(
    (owner: string) => {
      const isFavorite = favoriteProviders.includes(owner);
      updateFavoriteProviders(isFavorite ? favoriteProviders.filter(favorite => favorite !== owner) : favoriteProviders.concat(owner));
    },
    [favoriteProviders, updateFavoriteProviders]
  );

  const { refetch: refetchProviders } = providerSearch;
  const { refetch: refetchLocations } = providerLocations;
  const retryProviders = useCallback(() => {
    if (!hasNoFavoriteToShow) refetchProviders();
  }, [hasNoFavoriteToShow, refetchProviders]);

  const matchingLocationIds = useMemo(
    () => (hasNarrowingFilter(filters, search) ? findMatchingLocationIds(locations, filters, search.trim(), favoriteProviders) : null),
    [filters, search, locations, favoriteProviders]
  );

  return {
    search,
    changeSearch,
    filters,
    updateFilters,
    clearFilters,
    hasFilters: hasNarrowingFilter(filters, search) || !filters.isActiveOnly || !filters.isAuditedOnly,
    pageIndex,
    changePageIndex: setPageIndex,
    pageCount: Math.ceil(matchingProviderCount / PAGE_SIZE),
    matchingProviderCount,
    providers,
    hasLoadedProviders,
    isLoadingProviders: isSearchingProviders,
    hasFailedToLoadProviders: !hasLoadedProviders && providerSearch.isError && !isSearchingProviders,
    retryProviders,
    locations,
    isLoadingLocations: providerLocations.isLoading,
    hasFailedToLoadLocations: !providerLocations.data && providerLocations.isError && !providerLocations.isFetching,
    retryLocations: refetchLocations,
    matchingLocationIds,
    regionOptions: useMemo(
      () =>
        countOptions(
          locations.flatMap(location => (location.locationRegion ? [location.locationRegion] : [])),
          filters.regions
        ),
      [locations, filters.regions]
    ),
    gpuModelOptions: useMemo(
      () =>
        countOptions(
          locations.flatMap(location => location.gpuModels),
          filters.gpuModels
        ),
      [locations, filters.gpuModels]
    ),
    networkStats: useMemo(() => buildNetworkStats(dashboard.data, locations), [dashboard.data, locations]),
    favoriteProviders,
    toggleFavorite
  };
}

function hasNarrowingFilter(filters: ProviderFilters, search: string): boolean {
  return !!search.trim() || filters.regions.length > 0 || filters.gpuModels.length > 0 || filters.isGpuOnly || filters.isFavoritesOnly;
}

/** Mirrors the provider search's matching on the located providers, so the globe can light the pins the table lists. */
function findMatchingLocationIds(locations: ApiProviderLocation[], filters: ProviderFilters, search: string, favoriteProviders: string[]): Set<string> {
  const term = search.toLowerCase();
  const regions = new Set(filters.regions);
  const gpuModels = new Set(filters.gpuModels.map(model => model.toLowerCase()));
  const favorites = new Set(favoriteProviders);

  const matches = locations.filter(
    location =>
      (!filters.isAuditedOnly || location.isAudited) &&
      (!filters.isFavoritesOnly || favorites.has(location.owner)) &&
      (regions.size === 0 || (!!location.locationRegion && regions.has(location.locationRegion))) &&
      (!filters.isGpuOnly || totalOf(location.stats.gpu) > 0) &&
      (gpuModels.size === 0 || location.gpuModels.some(model => gpuModels.has(model.toLowerCase()))) &&
      (!term || location.hostUri.toLowerCase().includes(term) || location.owner.includes(term))
  );

  return new Set(matches.map(location => location.owner));
}

function countOptions(values: string[], selected: string[]): FilterOption[] {
  const counts = new Map<string, number>();
  values.forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
  selected.forEach(value => counts.set(value, counts.get(value) ?? 0));

  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

function buildNetworkStats(dashboard: ReturnType<typeof useDashboardData>["data"], locations: ApiProviderLocation[]): NetworkStats {
  const uptimes = locations.flatMap(location => (location.uptime30d === null || location.uptime30d === undefined ? [] : [location.uptime30d]));

  return {
    availableGpuCount: dashboard?.networkCapacity.availableGPU ?? null,
    activeProviderCount: dashboard?.networkCapacity.activeProviderCount ?? null,
    availableVcpuCount: dashboard ? Math.round(dashboard.networkCapacity.availableCPU / MILLICORES_PER_VCPU) : null,
    activeLeaseCount: dashboard?.now.activeLeaseCount ?? null,
    averageUptime30d: uptimes.length > 0 ? uptimes.reduce((total, uptime) => total + uptime, 0) / uptimes.length : null
  };
}

/** Cuts on UTF-16 units, which the API's limit counts, without leaving half an emoji, which the URL encoder refuses. */
function capSearchLength(search: string): string {
  const capped = search.slice(0, MAX_SEARCH_LENGTH);
  return HIGH_SURROGATE_AT_END.test(capped) ? capped.slice(0, -1) : capped;
}
