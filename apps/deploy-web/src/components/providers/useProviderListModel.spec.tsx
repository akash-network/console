import { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderSearchPage, ProviderSearchParams } from "@src/queries/useProvidersQuery";
import type { LeaseDto } from "@src/types/deployment";
import type { ApiProviderList, ApiProviderLocation } from "@src/types/provider";
import { UrlService } from "@src/utils/urlUtils";
import type { DEPENDENCIES } from "./useProviderListModel";
import { DEFAULT_PAGE_SIZE, MAX_SEARCHED_FAVORITES, useProviderListModel } from "./useProviderListModel";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useProviderListModel.name, () => {
  it("asks for the first page of online audited providers with the most active leases first", () => {
    const { useProviderSearch } = setup();

    expect(useProviderSearch).toHaveBeenLastCalledWith(
      {
        search: undefined,
        online: true,
        audited: true,
        addresses: undefined,
        sort: "active-leases-desc",
        walletAddress: undefined,
        skip: 0,
        limit: DEFAULT_PAGE_SIZE
      },
      { enabled: true }
    );
  });

  it("asks for offline and unaudited providers too once both filters are cleared", () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changeIsFilteringActive(false));
    act(() => result.current.changeIsFilteringAudited(false));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ online: undefined, audited: undefined }), { enabled: true });
    expect(result.current).toMatchObject({ isFilteringActive: false, isFilteringAudited: false });
  });

  it("limits the search to the favorite providers while filtering favorites", () => {
    const { result, useProviderSearch } = setup({ favoriteProviders: ["akash1favorite"] });

    act(() => result.current.changeIsFilteringFavorites(true));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ addresses: ["akash1favorite"] }), { enabled: true });
    expect(result.current.isFilteringFavorites).toBe(true);
  });

  it("asks for no more favorites than the provider search accepts", () => {
    const favoriteProviders = Array.from({ length: MAX_SEARCHED_FAVORITES + 1 }, (_, index) => `akash1favorite${index}`);
    const { result, useProviderSearch } = setup({ favoriteProviders });

    act(() => result.current.changeIsFilteringFavorites(true));

    expect(useProviderSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ addresses: favoriteProviders.slice(0, MAX_SEARCHED_FAVORITES) }),
      expect.anything()
    );
  });

  it("shows no provider and asks for none while filtering favorites without any", () => {
    const { result, useProviderSearch } = setup({ favoriteProviders: [], page: createPage([createProvider("akash1stale")], 1) });

    act(() => result.current.changeIsFilteringFavorites(true));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.anything(), { enabled: false });
    expect(result.current).toMatchObject({ providers: [], pageCount: 0, hasLoadedProviders: true });
  });

  it("asks for the page the user moved to", () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changePageIndex(2));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 2 * DEFAULT_PAGE_SIZE, limit: DEFAULT_PAGE_SIZE }), expect.anything());
    expect(result.current.pageIndex).toBe(2);
  });

  it("asks for pages of the size the user picked, from the first one", () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changePageIndex(2));
    act(() => result.current.changePageSize(25));

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, limit: 25 }), expect.anything());
    expect(result.current.pageSize).toBe(25);
  });

  it.each([
    ["the online filter", (model: Model) => model.changeIsFilteringActive(false)],
    ["the audited filter", (model: Model) => model.changeIsFilteringAudited(false)],
    ["the favorites filter", (model: Model) => model.changeIsFilteringFavorites(true)],
    ["the search", (model: Model) => model.changeSearch("europlots")],
    ["the sort", (model: Model) => model.changeSort("gpu-available-desc")]
  ])("returns to the first page when %s changes", (_, change) => {
    const { result } = setup({ favoriteProviders: ["akash1favorite"] });

    act(() => result.current.changePageIndex(3));
    act(() => change(result.current));

    expect(result.current.pageIndex).toBe(0);
  });

  it("asks for the search once typing settles, without its surrounding spaces", async () => {
    const { result, useProviderSearch } = setup();

    act(() => result.current.changeSearch("  europlots "));

    expect(result.current.search).toBe("  europlots ");
    await waitFor(() => expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ search: "europlots" }), expect.anything()));
  });

  it("changes the sort through the url", () => {
    const { result, router } = setup();

    act(() => result.current.changeSort("gpu-available-desc"));

    expect(router.replace).toHaveBeenCalledWith(UrlService.providers("gpu-available-desc"), { scroll: false });
  });

  it.each([
    ["active-leases-asc", "active-leases-asc", undefined],
    ["gpu-available-desc", "gpus-desc", undefined],
    ["my-leases-desc", "wallet-leases-desc", "akash1wallet"],
    ["my-active-leases-desc", "wallet-active-leases-desc", "akash1wallet"]
  ])("asks the provider search to sort %s as %s", (sort, searchSort, walletAddress) => {
    const { result, useProviderSearch } = setup({ sort, address: "akash1wallet" });

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: searchSort, walletAddress }), expect.anything());
    expect(result.current.sort).toBe(sort);
  });

  it("offers every sort to a connected wallet", () => {
    const { result } = setup({ address: "akash1wallet" });

    expect(result.current.sortOptions.map(option => option.id)).toEqual([
      "active-leases-desc",
      "active-leases-asc",
      "my-leases-desc",
      "my-active-leases-desc",
      "gpu-available-desc"
    ]);
  });

  it("sorts by active leases and offers no wallet sort without a wallet", () => {
    const { result, useProviderSearch } = setup({ sort: "my-leases-desc", address: "" });

    expect(useProviderSearch).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "active-leases-desc", walletAddress: undefined }), expect.anything());
    expect(result.current.sort).toBe("active-leases-desc");
    expect(result.current.sortOptions.map(option => option.id)).toEqual(["active-leases-desc", "active-leases-asc", "gpu-available-desc"]);
  });

  it("sorts by active leases when the url names no sort it knows", () => {
    const { result } = setup({ sort: "most-popular" });

    expect(result.current.sort).toBe("active-leases-desc");
  });

  it("counts the pages from how many providers matched", () => {
    const { result } = setup({ page: createPage([], 21) });

    expect(result.current.pageCount).toBe(3);
  });

  it("counts the leases the wallet holds on each listed provider", () => {
    const leases = [createLease("akash1first", "active"), createLease("akash1first", "closed"), createLease("akash1second", "active")];
    const { result } = setup({ page: createPage([createProvider("akash1first"), createProvider("akash1third")], 2), leases });

    expect(result.current.providers.map(({ owner, userLeases, userActiveLeases }) => ({ owner, userLeases, userActiveLeases }))).toEqual([
      { owner: "akash1first", userLeases: 2, userActiveLeases: 1 },
      { owner: "akash1third", userLeases: 0, userActiveLeases: 0 }
    ]);
  });

  it("counts no lease before the wallet's leases load", () => {
    const { result } = setup({ page: createPage([createProvider("akash1first")], 1), leases: null });

    expect(result.current.providers[0]).toMatchObject({ userLeases: 0, userActiveLeases: 0 });
  });

  it("loads the wallet's leases once, on demand", () => {
    const { getLeases, useAllLeases } = setup({ address: "akash1wallet" });

    expect(useAllLeases).toHaveBeenCalledWith("akash1wallet", { enabled: false });
    expect(getLeases).toHaveBeenCalledTimes(1);
  });

  it("has providers to show once the first page arrives", () => {
    const { result } = setup({ page: createPage([createProvider("akash1first")], 1) });

    expect(result.current).toMatchObject({ hasLoadedProviders: true, pageCount: 1 });
    expect(result.current.providers.map(provider => provider.owner)).toEqual(["akash1first"]);
  });

  it("has no provider to show before the first page arrives", () => {
    const { result } = setup({ page: undefined, isSearching: true });

    expect(result.current).toMatchObject({ providers: [], pageCount: 0, hasLoadedProviders: false, isLoadingProviders: true });
  });

  it("hands over the provider locations and the network capacity", () => {
    const locations = [mock<ApiProviderLocation>({ owner: "akash1first" })];
    const networkCapacity = mock<NonNullable<ReturnType<typeof DEPENDENCIES.useNetworkCapacity>["data"]>>();
    const { result } = setup({ locations, networkCapacity });

    expect(result.current.locations).toEqual(locations);
    expect(result.current.networkCapacity).toEqual(networkCapacity);
  });

  it.each([
    ["the providers", { isSearching: true }],
    ["the locations", { isLocating: true }],
    ["the wallet's leases", { isLoadingLeases: true }],
    ["the network capacity", { isLoadingNetworkCapacity: true }]
  ])("reports loading while %s load", (_, loading) => {
    const { result } = setup(loading);

    expect(result.current.isLoading).toBe(true);
  });

  it("reports no loading once everything loaded", () => {
    const { result } = setup();

    expect(result.current.isLoading).toBe(false);
  });

  it("refreshes the providers and their locations", () => {
    const { result, refetchProviders, refetchLocations } = setup();

    act(() => result.current.refresh());

    expect(refetchProviders).toHaveBeenCalled();
    expect(refetchLocations).toHaveBeenCalled();
  });

  type Model = ReturnType<typeof useProviderListModel>;

  function createProvider(owner: string) {
    return mock<ApiProviderList>({ owner });
  }

  function createPage(providers: ApiProviderList[], total: number): ProviderSearchPage {
    return { providers, pagination: { total, skip: 0, limit: DEFAULT_PAGE_SIZE, hasMore: providers.length < total } };
  }

  function createLease(provider: string, state: string) {
    return mock<LeaseDto>({ provider, state });
  }

  function setup(
    input: {
      address?: string;
      sort?: string;
      favoriteProviders?: string[];
      page?: ProviderSearchPage;
      isSearching?: boolean;
      locations?: ApiProviderLocation[];
      isLocating?: boolean;
      leases?: LeaseDto[] | null;
      isLoadingLeases?: boolean;
      networkCapacity?: ReturnType<typeof DEPENDENCIES.useNetworkCapacity>["data"];
      isLoadingNetworkCapacity?: boolean;
    } = {}
  ) {
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>();
    const searchParams = new ReadonlyURLSearchParams(input.sort ? { sort: input.sort } : {});
    const refetchProviders = vi.fn();
    const refetchLocations = vi.fn();
    const getLeases = vi.fn();
    const page = "page" in input ? input.page : createPage([], 0);
    const providerSearch = mock<ReturnType<typeof DEPENDENCIES.useProviderSearch>>({ data: page, isFetching: !!input.isSearching, refetch: refetchProviders });
    const providerLocations = mock<ReturnType<typeof DEPENDENCIES.useProviderLocations>>({
      data: input.locations,
      isFetching: !!input.isLocating,
      refetch: refetchLocations
    });
    const networkCapacity = mock<ReturnType<typeof DEPENDENCIES.useNetworkCapacity>>({
      data: input.networkCapacity,
      isFetching: !!input.isLoadingNetworkCapacity
    });
    const allLeases = mock<ReturnType<typeof DEPENDENCIES.useAllLeases>>({
      data: "leases" in input ? input.leases : [],
      isFetching: !!input.isLoadingLeases,
      refetch: getLeases
    });
    const localNotes = mock<ReturnType<typeof DEPENDENCIES.useLocalNotes>>({ favoriteProviders: input.favoriteProviders ?? [] });
    const wallet = mock<ReturnType<typeof DEPENDENCIES.useWallet>>({ address: input.address ?? "" });
    const useProviderSearch = vi.fn((_params: ProviderSearchParams, _options?: { enabled?: boolean }) => providerSearch);
    const useAllLeases = vi.fn((_address: string, _options?: Parameters<typeof DEPENDENCIES.useAllLeases>[1]) => allLeases);

    const dependencies: typeof DEPENDENCIES = {
      useWallet: () => wallet,
      useLocalNotes: () => localNotes,
      useRouter: () => router,
      useSearchParams: () => searchParams,
      useProviderSearch,
      useProviderLocations: () => providerLocations,
      useNetworkCapacity: () => networkCapacity,
      useAllLeases
    };

    const view = renderHook(() => useProviderListModel(dependencies));

    return { ...view, useProviderSearch, useAllLeases, router, refetchProviders, refetchLocations, getLeases };
  }
});
