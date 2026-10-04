import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderSearchPage, ProviderSearchParams } from "@src/queries/useProvidersQuery";
import type { DashboardData } from "@src/types/dashboard";
import type { ApiProviderList, ApiProviderLocation, StatsItem } from "@src/types/provider";
import type { DEPENDENCIES } from "./useProvidersExplorerModel";
import { MAX_SEARCH_LENGTH, MAX_SEARCHED_FAVORITES, PAGE_SIZE, useProvidersExplorerModel } from "./useProvidersExplorerModel";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useProvidersExplorerModel.name, () => {
  it("asks for the first page of online audited providers with the most active leases first", () => {
    const { useProviderSearch } = setup();

    expect(useProviderSearch).toHaveBeenLastCalledWith(
      {
        search: undefined,
        online: true,
        audited: true,
        addresses: undefined,
        regions: undefined,
        gpu: undefined,
        gpuModels: undefined,
        sort: "active-leases-desc",
        skip: 0,
        limit: PAGE_SIZE
      },
      { enabled: true }
    );
  });

  it("asks for the regions, GPU models and GPU-only providers the user picked, back on the first page", () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changePageIndex(2));
    act(() => result.current.updateFilters({ regions: ["eu-central"], gpuModels: ["h100"], isGpuOnly: true }));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ regions: ["eu-central"], gpuModels: ["h100"], gpu: true, skip: 0 }), {
      enabled: true
    });
    expect(result.current.pageIndex).toBe(0);
  });

  it("asks for offline and unaudited providers too once both filters are off", () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.updateFilters({ isActiveOnly: false, isAuditedOnly: false }));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ online: undefined, audited: undefined }), { enabled: true });
    expect(result.current.hasFilters).toBe(true);
  });

  it("limits the search to the favorite providers, no more than the search accepts", () => {
    const favoriteProviders = Array.from({ length: MAX_SEARCHED_FAVORITES + 1 }, (_, index) => `akash1favorite${index}`);
    const { result, useProviderSearch } = setup({ favoriteProviders });

    act(() => result.current.updateFilters({ isFavoritesOnly: true }));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ addresses: favoriteProviders.slice(0, MAX_SEARCHED_FAVORITES) }), {
      enabled: true
    });
  });

  it("shows no provider and asks for none while filtering favorites without any", () => {
    const { result, useProviderSearch } = setup({ favoriteProviders: [], page: createPage([createProvider("akash1stale")], 1) });

    act(() => result.current.updateFilters({ isFavoritesOnly: true }));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });
    expect(result.current).toMatchObject({ providers: [], matchingProviderCount: 0, pageCount: 0, hasLoadedProviders: true });
  });

  it("answers the page of providers, how many matched and how many pages they fill", () => {
    const providers = [createProvider("akash1first"), createProvider("akash1second")];
    const { result } = setup({ page: createPage(providers, 23) });

    expect(result.current).toMatchObject({ providers, matchingProviderCount: 23, pageCount: 3, hasLoadedProviders: true, hasFailedToLoadProviders: false });
  });

  it("asks for the page the user moved to", () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changePageIndex(2));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 2 * PAGE_SIZE, limit: PAGE_SIZE }), expect.anything());
  });

  it("searches for the trimmed term once the user pauses typing, back on the first page", async () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changePageIndex(1));
    act(() => result.current.changeSearch("  europlots  "));

    expect(result.current).toMatchObject({ search: "  europlots  ", pageIndex: 0 });
    await waitFor(() => expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ search: "europlots" }), expect.anything()));
  });

  it("caps the search at the length the API accepts without splitting an emoji", async () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changeSearch(`${"a".repeat(MAX_SEARCH_LENGTH - 1)}😀`));

    await waitFor(() =>
      expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ search: "a".repeat(MAX_SEARCH_LENGTH - 1) }), expect.anything())
    );
  });

  it("clears every filter and the search", () => {
    const { result } = setup();

    act(() => result.current.changeSearch("europlots"));
    act(() => result.current.updateFilters({ regions: ["eu-central"], isAuditedOnly: false }));
    act(() => result.current.clearFilters());

    expect(result.current).toMatchObject({
      search: "",
      hasFilters: false,
      filters: { regions: [], gpuModels: [], isGpuOnly: false, isActiveOnly: true, isAuditedOnly: true, isFavoritesOnly: false }
    });
  });

  it("reports a failed search once it stops retrying, and retries on demand", () => {
    const { result, refetchProviders } = setup({ page: undefined, isSearchFailed: true });

    result.current.retryProviders();

    expect(result.current.hasFailedToLoadProviders).toBe(true);
    expect(refetchProviders).toHaveBeenCalledTimes(1);
  });

  it("doesn't report a failed search while it is still retrying", () => {
    const { result } = setup({ page: undefined, isSearchFailed: true, isSearching: true });

    expect(result.current).toMatchObject({ hasFailedToLoadProviders: false, isLoadingProviders: true });
  });

  it("asks for nothing on retry while filtering favorites without any", () => {
    const { result, refetchProviders } = setup({ favoriteProviders: [] });

    act(() => result.current.updateFilters({ isFavoritesOnly: true }));
    result.current.retryProviders();

    expect(refetchProviders).not.toHaveBeenCalled();
  });

  it("reports a failed provider map and retries it on demand", () => {
    const { result, refetchLocations } = setup({ locations: undefined, isLocatingFailed: true });

    result.current.retryLocations();

    expect(result.current.hasFailedToLoadLocations).toBe(true);
    expect(refetchLocations).toHaveBeenCalledTimes(1);
  });

  it("adds a provider to the favorites and removes it again", () => {
    const { result, updateFavoriteProviders } = setup({ favoriteProviders: ["akash1kept"] });

    act(() => result.current.toggleFavorite("akash1new"));
    expect(updateFavoriteProviders).toHaveBeenLastCalledWith(["akash1kept", "akash1new"]);

    act(() => result.current.toggleFavorite("akash1kept"));
    expect(updateFavoriteProviders).toHaveBeenLastCalledWith([]);
  });

  it("offers the regions and GPU models on the map, most common first, keeping the picked ones", () => {
    const locations = [
      createLocation({ owner: "akash1a", locationRegion: "eu-central", gpuModels: ["h100", "a100"] }),
      createLocation({ owner: "akash1b", locationRegion: "eu-central", gpuModels: ["h100"] }),
      createLocation({ owner: "akash1c", locationRegion: "na-us-west", gpuModels: [] }),
      createLocation({ owner: "akash1d", locationRegion: null, gpuModels: [] })
    ];
    const { result } = setup({ locations });

    act(() => result.current.updateFilters({ regions: ["sa-brazil"] }));

    expect(result.current.regionOptions).toEqual([
      { value: "eu-central", count: 2 },
      { value: "na-us-west", count: 1 },
      { value: "sa-brazil", count: 0 }
    ]);
    expect(result.current.gpuModelOptions).toEqual([
      { value: "h100", count: 2 },
      { value: "a100", count: 1 }
    ]);
  });

  it("lights no particular pin until the user narrows the list", () => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })] });

    expect(result.current.matchingLocationIds).toBeNull();
  });

  it("lights the pins of the located providers the narrowed list would show", async () => {
    const locations = [
      createLocation({ owner: "akash1match", hostUri: "https://provider.europlots.com:8443", locationRegion: "eu-central", gpuModels: ["H100"], gpus: 4 }),
      createLocation({
        owner: "akash1unaudited",
        hostUri: "https://provider.europlots2.com:8443",
        locationRegion: "eu-central",
        gpuModels: ["h100"],
        gpus: 4,
        isAudited: false
      }),
      createLocation({ owner: "akash1elsewhere", hostUri: "https://provider.europlots3.com:8443", locationRegion: "na-us-west", gpuModels: ["h100"], gpus: 4 }),
      createLocation({ owner: "akash1cpu", hostUri: "https://provider.europlots4.com:8443", locationRegion: "eu-central", gpuModels: [], gpus: 0 }),
      createLocation({
        owner: "akash1othermodel",
        hostUri: "https://provider.europlots5.com:8443",
        locationRegion: "eu-central",
        gpuModels: ["a100"],
        gpus: 2
      }),
      createLocation({ owner: "akash1othername", hostUri: "https://provider.other.com:8443", locationRegion: "eu-central", gpuModels: ["h100"], gpus: 4 })
    ];
    const { result } = setup({ locations });

    act(() => result.current.updateFilters({ regions: ["eu-central"], isGpuOnly: true, gpuModels: ["h100"] }));
    act(() => result.current.changeSearch("EUROPLOTS"));

    expect(result.current.matchingLocationIds).toEqual(new Set(["akash1match"]));
  });

  it("lights only the favorite pins while filtering favorites, matching an address too", () => {
    const locations = [createLocation({ owner: "akash1favorite" }), createLocation({ owner: "akash1other" })];
    const { result } = setup({ locations, favoriteProviders: ["akash1favorite", "akash1other"] });

    act(() => result.current.updateFilters({ isFavoritesOnly: true, isAuditedOnly: false }));
    act(() => result.current.changeSearch("akash1fav"));

    expect(result.current.matchingLocationIds).toEqual(new Set(["akash1favorite"]));
  });

  it("sums up the network from the dashboard and the located providers' uptime", () => {
    const dashboard = mock<DashboardData>({
      now: mock<DashboardData["now"]>({ activeLeaseCount: 678 }),
      networkCapacity: mock<DashboardData["networkCapacity"]>({ availableGPU: 60, activeProviderCount: 59, availableCPU: 8_868_362 })
    });
    const locations = [
      createLocation({ owner: "akash1a", uptime30d: 0.99 }),
      createLocation({ owner: "akash1b", uptime30d: 0.9 }),
      createLocation({ owner: "akash1c", uptime30d: null })
    ];
    const { result } = setup({ dashboard, locations });

    expect(result.current.networkStats).toEqual({
      availableGpuCount: 60,
      activeProviderCount: 59,
      availableVcpuCount: 8868,
      activeLeaseCount: 678,
      averageUptime30d: expect.closeTo(0.945, 5)
    });
  });

  it("leaves the network numbers empty until they load", () => {
    const { result } = setup({ dashboard: undefined, locations: [] });

    expect(result.current.networkStats).toEqual({
      availableGpuCount: null,
      activeProviderCount: null,
      availableVcpuCount: null,
      activeLeaseCount: null,
      averageUptime30d: null
    });
  });

  function createProvider(owner: string) {
    return mock<ApiProviderList>({ owner });
  }

  function createPage(providers: ApiProviderList[], total: number): ProviderSearchPage {
    return { providers, pagination: { total, skip: 0, limit: PAGE_SIZE, hasMore: providers.length < total } };
  }

  function createLocation(
    overrides: Partial<Omit<ApiProviderLocation, "stats" | "locationRegion" | "uptime30d">> & {
      locationRegion?: string | null;
      uptime30d?: number | null;
      gpus?: number;
    }
  ): ApiProviderLocation {
    const { gpus = 0, ...fields } = overrides;
    const item = (total: number): StatsItem => ({ active: 0, available: total, pending: 0, total });
    return Object.assign(mock<ApiProviderLocation>(), {
      owner: "akash1provider",
      hostUri: "https://provider.example.com:8443",
      isAudited: true,
      locationRegion: null,
      uptime30d: null,
      gpuModels: [],
      stats: { cpu: item(8000), gpu: item(gpus), memory: item(0), storage: { ephemeral: item(0), persistent: item(0), total: item(0) } },
      ...fields
    });
  }

  function setup(
    input: {
      favoriteProviders?: string[];
      page?: ProviderSearchPage;
      isSearching?: boolean;
      isSearchFailed?: boolean;
      locations?: ApiProviderLocation[];
      isLocatingFailed?: boolean;
      dashboard?: DashboardData;
    } = {}
  ) {
    const refetchProviders = vi.fn();
    const refetchLocations = vi.fn();
    const updateFavoriteProviders = vi.fn();
    const providerSearch = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderSearch>>(), {
      data: "page" in input ? input.page : createPage([], 0),
      isFetching: !!input.isSearching,
      isError: !!input.isSearchFailed,
      isPaused: false,
      refetch: refetchProviders
    });
    const providerLocations = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProviderLocations>>(), {
      data: "locations" in input ? input.locations : [],
      isLoading: false,
      isFetching: false,
      isError: !!input.isLocatingFailed,
      refetch: refetchLocations
    });
    const dashboard = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDashboardData>>(), { data: input.dashboard });
    const localNotes = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>(), {
      favoriteProviders: input.favoriteProviders ?? [],
      updateFavoriteProviders
    });
    const useProviderSearch = vi.fn((_params: ProviderSearchParams, _options?: { enabled?: boolean }) => providerSearch);

    const dependencies: typeof DEPENDENCIES = {
      useLocalNotes: () => localNotes,
      useProviderSearch,
      useProviderLocations: () => providerLocations,
      useDashboardData: () => dashboard
    };

    const view = renderHook(() => useProvidersExplorerModel(dependencies));

    return { ...view, useProviderSearch, refetchProviders, refetchLocations, updateFavoriteProviders };
  }
});
