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

  it.each([
    ["offline providers", { isActiveOnly: false }],
    ["unaudited providers", { isAuditedOnly: false }]
  ])("counts showing %s as a filter without narrowing the pins", (_, change) => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })] });

    act(() => result.current.updateFilters(change));

    expect(result.current).toMatchObject({ hasFilters: true, matchingLocationIds: null });
  });

  it.each([
    ["regions", { regions: ["eu-central"] }],
    ["GPU models", { gpuModels: ["h100"] }],
    ["GPU providers only", { isGpuOnly: true }],
    ["favorites", { isFavoritesOnly: true }]
  ])("narrows the list and the pins by %s alone", (_, change) => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })] });

    act(() => result.current.updateFilters(change));

    expect(result.current.hasFilters).toBe(true);
    expect(result.current.matchingLocationIds).toBeInstanceOf(Set);
  });

  it("narrows the list and the pins by a search alone", () => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })] });

    act(() => result.current.changeSearch("akash1a"));

    expect(result.current).toMatchObject({ hasFilters: true, matchingLocationIds: new Set(["akash1a"]) });
  });

  it("ignores a search made only of spaces", () => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })] });

    act(() => result.current.changeSearch("   "));

    expect(result.current).toMatchObject({ hasFilters: false, matchingLocationIds: null });
  });

  it("limits the search to the favorite providers, no more than the search accepts", () => {
    const favoriteProviders = Array.from({ length: MAX_SEARCHED_FAVORITES + 1 }, (_, index) => `akash1favorite${index}`);
    const { result, useProviderSearch } = setup({ favoriteProviders });

    act(() => result.current.updateFilters({ isFavoritesOnly: true }));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ addresses: favoriteProviders.slice(0, MAX_SEARCHED_FAVORITES) }), {
      enabled: true
    });
  });

  it("lights only the favorites the search covers on the globe", () => {
    const favoriteProviders = Array.from({ length: MAX_SEARCHED_FAVORITES + 1 }, (_, index) => `akash1favorite${index}`);
    const { result } = setup({
      favoriteProviders,
      locations: [createLocation({ owner: favoriteProviders[0] }), createLocation({ owner: favoriteProviders[MAX_SEARCHED_FAVORITES] })]
    });

    act(() => result.current.updateFilters({ isFavoritesOnly: true }));

    expect(result.current.matchingLocationIds).toEqual(new Set([favoriteProviders[0]]));
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

  it("follows the providers, the map and the network numbers as they arrive", () => {
    const { result, rerender, providerSearch, providerLocations, dashboard } = setup({ page: undefined, locations: undefined, dashboard: undefined });
    const providers = [createProvider("akash1late")];
    const locations = [createLocation({ owner: "akash1late", locationRegion: "eu-central", gpuModels: ["h100"], uptime30d: 0.9 })];

    providerSearch.data = createPage(providers, 1);
    providerLocations.data = locations;
    dashboard.data = mock<DashboardData>({
      now: mock<DashboardData["now"]>({ activeLeaseCount: 12 }),
      networkCapacity: mock<DashboardData["networkCapacity"]>({ availableGPU: 3, activeProviderCount: 1, availableCPU: 4000 })
    });
    rerender();

    expect(result.current).toMatchObject({
      providers,
      locations,
      regionOptions: [{ value: "eu-central", count: 1 }],
      gpuModelOptions: [{ value: "h100", count: 1 }],
      networkStats: { availableGpuCount: 3, activeProviderCount: 1, availableVcpuCount: 4, activeLeaseCount: 12, averageUptime30d: 0.9 }
    });
  });

  it("asks for the page the user moved to", () => {
    const { result, useProviderSearch } = setup({ page: createPage([], 30) });

    act(() => result.current.changePageIndex(2));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 2 * PAGE_SIZE, limit: PAGE_SIZE }), expect.anything());
  });

  it("returns to the last page once the results shrink below the page the user is on", () => {
    const { result, rerender, providerSearch } = setup({ page: createPage([], 30) });
    act(() => result.current.changePageIndex(2));

    providerSearch.data = createPage([], 12);
    rerender();

    expect(result.current).toMatchObject({ pageIndex: 1, pageCount: 2 });
  });

  it("keeps the page while the shrunken results are still loading", () => {
    const { result, rerender, providerSearch } = setup({ page: createPage([], 30) });
    act(() => result.current.changePageIndex(2));

    Object.assign(providerSearch, { data: createPage([], 5), isFetching: true });
    rerender();

    expect(result.current.pageIndex).toBe(2);
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

  it("clears every filter and the search, back on the first page", () => {
    const { result } = setup();

    act(() => result.current.changeSearch("europlots"));
    act(() => result.current.updateFilters({ regions: ["eu-central"], isAuditedOnly: false }));
    act(() => result.current.changePageIndex(2));
    act(() => result.current.clearFilters());

    expect(result.current).toMatchObject({
      search: "",
      pageIndex: 0,
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

  it("keeps the providers it has when a later search fails", () => {
    const { result } = setup({ isSearchFailed: true });

    expect(result.current).toMatchObject({ hasFailedToLoadProviders: false, hasLoadedProviders: true });
  });

  it("reports neither providers nor a failure before the first search answers", () => {
    const { result } = setup({ page: undefined });

    expect(result.current).toMatchObject({ hasFailedToLoadProviders: false, hasLoadedProviders: false, providers: [] });
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

    expect(result.current).toMatchObject({ hasFailedToLoadLocations: true, locations: [] });
    expect(refetchLocations).toHaveBeenCalledTimes(1);
  });

  it("doesn't report a failed provider map while it is still retrying", () => {
    const { result } = setup({ locations: undefined, isLocatingFailed: true, isLocating: true });

    expect(result.current.hasFailedToLoadLocations).toBe(false);
  });

  it("keeps the provider map it has when a later refresh fails", () => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })], isLocatingFailed: true });

    expect(result.current.hasFailedToLoadLocations).toBe(false);
  });

  it("reports no failed provider map once it loads", () => {
    const { result } = setup({ locations: [createLocation({ owner: "akash1a" })] });

    expect(result.current.hasFailedToLoadLocations).toBe(false);
  });

  it("adds a provider to the favorites and removes it again", () => {
    const { result, updateFavoriteProviders } = setup({ favoriteProviders: ["akash1kept", "akash1gone"] });

    act(() => result.current.toggleFavorite("akash1new"));
    expect(updateFavoriteProviders).toHaveBeenLastCalledWith(["akash1kept", "akash1gone", "akash1new"]);

    act(() => result.current.toggleFavorite("akash1gone"));
    expect(updateFavoriteProviders).toHaveBeenLastCalledWith(["akash1kept"]);
  });

  it("toggles a favorite against the latest favorites", () => {
    const { result, rerender, localNotes, updateFavoriteProviders } = setup({ favoriteProviders: [] });

    localNotes.favoriteProviders = ["akash1saved"];
    rerender();
    act(() => result.current.toggleFavorite("akash1new"));

    expect(updateFavoriteProviders).toHaveBeenLastCalledWith(["akash1saved", "akash1new"]);
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

  it("orders the regions and GPU models by how common they are, then by name", () => {
    const locations = [
      createLocation({ owner: "akash1a", locationRegion: "na-us-west", gpuModels: ["rtx4090"] }),
      createLocation({ owner: "akash1b", locationRegion: "eu-west", gpuModels: ["h100"] }),
      createLocation({ owner: "akash1c", locationRegion: "eu-central", gpuModels: ["a100"] }),
      createLocation({ owner: "akash1d", locationRegion: "eu-west", gpuModels: ["h100", "a100"] }),
      createLocation({ owner: "akash1e", locationRegion: "eu-central", gpuModels: [] })
    ];
    const { result } = setup({ locations });

    expect(result.current.regionOptions).toEqual([
      { value: "eu-central", count: 2 },
      { value: "eu-west", count: 2 },
      { value: "na-us-west", count: 1 }
    ]);
    expect(result.current.gpuModelOptions).toEqual([
      { value: "a100", count: 2 },
      { value: "h100", count: 2 },
      { value: "rtx4090", count: 1 }
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
    act(() => result.current.changeSearch("  akash1fav  "));

    expect(result.current.matchingLocationIds).toEqual(new Set(["akash1favorite"]));
  });

  it("lights no pin of a provider left out of the favorites", () => {
    const locations = [createLocation({ owner: "akash1favorite" }), createLocation({ owner: "akash1other" })];
    const { result } = setup({ locations, favoriteProviders: ["akash1favorite"] });

    act(() => result.current.updateFilters({ isFavoritesOnly: true }));

    expect(result.current.matchingLocationIds).toEqual(new Set(["akash1favorite"]));
  });

  it("lights only the pins of providers with GPUs while showing GPU providers only", () => {
    const locations = [createLocation({ owner: "akash1gpu", gpus: 1 }), createLocation({ owner: "akash1cpu", gpus: 0 })];
    const { result } = setup({ locations });

    act(() => result.current.updateFilters({ isGpuOnly: true }));

    expect(result.current.matchingLocationIds).toEqual(new Set(["akash1gpu"]));
  });

  it("lights the pin of a provider running any of the picked GPU models", () => {
    const locations = [createLocation({ owner: "akash1mixed", gpuModels: ["h100", "a100"] }), createLocation({ owner: "akash1other", gpuModels: ["rtx4090"] })];
    const { result } = setup({ locations });

    act(() => result.current.updateFilters({ gpuModels: ["H100"] }));

    expect(result.current.matchingLocationIds).toEqual(new Set(["akash1mixed"]));
  });

  it("sums up the network from the dashboard and the located providers' uptime", () => {
    const dashboard = mock<DashboardData>({
      now: mock<DashboardData["now"]>({ activeLeaseCount: 678 }),
      networkCapacity: mock<DashboardData["networkCapacity"]>({ availableGPU: 60, activeProviderCount: 59, availableCPU: 8_868_362 })
    });
    const locations = [
      createLocation({ owner: "akash1a", uptime30d: 0.99 }),
      createLocation({ owner: "akash1b", uptime30d: 0.9 }),
      createLocation({ owner: "akash1c", uptime30d: null }),
      createLocation({ owner: "akash1d", uptime30d: undefined })
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
      isLocating?: boolean;
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
      isFetching: !!input.isLocating,
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

    return {
      ...view,
      useProviderSearch,
      refetchProviders,
      refetchLocations,
      updateFavoriteProviders,
      providerSearch,
      providerLocations,
      dashboard,
      localNotes
    };
  }
});
