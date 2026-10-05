import { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderLookupService } from "@src/services/provider-lookup/provider-lookup.service";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import { SKIP_REPORTING_PROVIDER_POLL_FAILURE } from "@src/services/query-error-policy/query-error-policy";
import type { DashboardData } from "@src/types/dashboard";
import type { ApiProviderList, ApiProviderLocation, ProviderStatus, ProviderVersion } from "@src/types/provider";
import { ApiUrlService } from "@src/utils/apiUtils";
import type { ProviderSearchPage, ProviderSearchParams } from "./useProvidersQuery";
import { useDashboardData, useProviderLocations, useProvidersByAddresses, useProviderSearch, useProviderStatus } from "./useProvidersQuery";

import { setupQuery } from "@tests/unit/query-client";

const PROVIDER_VERSION = mock<ProviderVersion>({
  akash: { version: "v0.10.0", commit: "abc123" },
  kube: { major: "1", minor: "31", gitVersion: "v1.31.0" }
});

describe(useProvidersByAddresses.name, () => {
  it("returns the providers the lookup found, leaving out the unknown ones", async () => {
    const { result } = setup({ addresses: ["akash1first", "akash1unknown", "akash1second"], knownAddresses: ["akash1first", "akash1second"] });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.map(provider => provider.owner)).toEqual(["akash1first", "akash1second"]);
  });

  it("looks up an address listed twice once", async () => {
    const { result, providerLookup } = setup({ addresses: ["akash1first", "akash1first"], knownAddresses: ["akash1first"] });

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(providerLookup.findByAddress).toHaveBeenCalledExactlyOnceWith("akash1first");
    expect(result.current.data.map(provider => provider.owner)).toEqual(["akash1first"]);
  });

  it("reports loading while a lookup is pending", () => {
    const { result } = setup({ addresses: ["akash1first"], knownAddresses: [], pending: true });

    expect(result.current).toMatchObject({ data: [], isLoading: true, isFetching: true });
  });

  it("only looks up the address that joined the list", async () => {
    const { result, providerLookup, rerender } = setup({ addresses: ["akash1first"], knownAddresses: ["akash1first", "akash1second"] });
    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    rerender({ addresses: ["akash1first", "akash1second"] });
    await vi.waitFor(() => expect(result.current.data).toHaveLength(2));

    expect(providerLookup.findByAddress.mock.calls).toEqual([["akash1first"], ["akash1second"]]);
  });

  it("looks nothing up while disabled", () => {
    const { result, providerLookup } = setup({ addresses: ["akash1first"], knownAddresses: ["akash1first"], enabled: false });

    expect(providerLookup.findByAddress).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: [], isLoading: false });
  });

  it("returns no provider and loads nothing for no address", () => {
    const { result, providerLookup } = setup({ addresses: [], knownAddresses: [] });

    expect(providerLookup.findByAddress).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ data: [], isLoading: false, isFetching: false });
  });

  function setup(input: { addresses: string[]; knownAddresses: string[]; enabled?: boolean; pending?: boolean }) {
    const providerLookup = mock<ProviderLookupService>({
      findByAddress: vi.fn(async (address: string) => {
        if (input.pending) return new Promise<never>(() => undefined);
        return input.knownAddresses.includes(address) ? mock<ApiProviderList>({ owner: address }) : null;
      })
    });
    let addresses = input.addresses;
    const view = setupQuery(() => useProvidersByAddresses(addresses, { enabled: input.enabled }), {
      services: { providerLookup: () => providerLookup }
    });

    return {
      ...view,
      providerLookup,
      rerender(next: { addresses: string[] }) {
        addresses = next.addresses;
        view.rerender();
      }
    };
  }
});

describe(useProviderSearch.name, () => {
  it("asks the provider search for the page, naming the addresses in one comma-separated value", async () => {
    const page: ProviderSearchPage = { providers: [], pagination: { total: 0, skip: 10, limit: 10, hasMore: false } };
    const { result, httpClient } = setup({
      params: { sort: "gpus-desc", online: true, addresses: ["akash1first", "akash1second"], skip: 10, limit: 10 },
      page
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(page);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(ApiUrlService.providerSearch(), {
      params: { sort: "gpus-desc", online: true, addresses: "akash1first,akash1second", regions: undefined, gpuModels: undefined, skip: 10, limit: 10 }
    });
  });

  it("names the regions and GPU models in comma-separated values", async () => {
    const { result, httpClient } = setup({
      params: { sort: "active-leases-desc", regions: ["eu-central", "na-us-west"], gpu: true, gpuModels: ["h100", "a100"], skip: 0, limit: 10 }
    });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(ApiUrlService.providerSearch(), {
      params: { sort: "active-leases-desc", addresses: undefined, regions: "eu-central,na-us-west", gpu: true, gpuModels: "h100,a100", skip: 0, limit: 10 }
    });
  });

  it("names no address when the search is not limited to any", async () => {
    const { result, httpClient } = setup({ params: { sort: "active-leases-desc", skip: 0, limit: 10 } });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(httpClient.get).toHaveBeenCalledWith(ApiUrlService.providerSearch(), {
      params: { sort: "active-leases-desc", addresses: undefined, regions: undefined, gpuModels: undefined, skip: 0, limit: 10 }
    });
  });

  it("searches nothing while disabled", () => {
    const { httpClient } = setup({ params: { sort: "active-leases-desc", skip: 0, limit: 10 }, enabled: false });

    expect(httpClient.get).not.toHaveBeenCalled();
  });

  function setup(input: { params: ProviderSearchParams; page?: ProviderSearchPage; enabled?: boolean }) {
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockResolvedValue({ data: { data: input.page ?? { providers: [], pagination: { total: 0, skip: 0, limit: 10, hasMore: false } } } });
    const view = setupQuery(() => useProviderSearch(input.params, { enabled: input.enabled }), {
      services: { publicConsoleApiHttpClient: () => httpClient }
    });

    return { ...view, httpClient };
  }
});

describe(useProviderLocations.name, () => {
  it("answers where each online provider is", async () => {
    const locations = [mock<ApiProviderLocation>({ owner: "akash1first" })];
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockResolvedValue({ data: { data: locations } });

    const { result } = setupQuery(() => useProviderLocations(), { services: { publicConsoleApiHttpClient: () => httpClient } });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(locations);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(ApiUrlService.providerLocations());
  });
});

describe(useProviderStatus.name, () => {
  it("sums up the provider's status and version", async () => {
    const { result, providerProxy, provider } = setup({ version: PROVIDER_VERSION });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({
      name: "provider.example.com",
      orderCount: 2,
      deploymentCount: 3,
      leaseCount: 4,
      akash: { version: "v0.10.0", commit: "abc123" },
      kube: { major: "1", minor: "31", gitVersion: "v1.31.0" }
    });
    expect(providerProxy.request).toHaveBeenCalledWith("/status", { providerIdentity: provider });
    expect(providerProxy.request).toHaveBeenCalledWith("/version", { providerIdentity: provider });
  });

  it("sums up a provider that reports no version", async () => {
    const { result } = setup({ version: undefined });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ name: "provider.example.com", akash: undefined, kube: undefined });
  });

  it("asks the query cache not to report a provider the proxy cannot reach", async () => {
    const { queryClient } = setup({ version: PROVIDER_VERSION });

    await vi.waitFor(() => expect(queryClient.getQueryCache().getAll()).not.toHaveLength(0));
    expect(queryClient.getQueryCache().getAll()[0].options.meta).toBe(SKIP_REPORTING_PROVIDER_POLL_FAILURE);
  });

  function setup(input: { version: ProviderVersion | undefined }) {
    const provider = mock<ApiProviderList>({ owner: "akash1provider", hostUri: "https://provider.example.com:8443" });
    const status = mock<ProviderStatus>({
      cluster_public_hostname: "provider.example.com",
      bidengine: { orders: 2 },
      manifest: { deployments: 3 },
      cluster: { leases: 4, inventory: { active: [], available: { nodes: [] }, pending: [], error: "" } }
    });
    const providerProxy = mock<ProviderProxyService>({
      request: vi.fn().mockImplementation(async (url: string) => ({ data: url === "/status" ? status : input.version }))
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = setupQuery(() => useProviderStatus(provider), {
      services: { providerProxy: () => providerProxy, queryClient: () => queryClient }
    });

    return { ...view, providerProxy, provider, queryClient };
  }
});

describe(useDashboardData.name, () => {
  it("answers the network dashboard numbers", async () => {
    const dashboardData = mock<DashboardData>({ now: mock<DashboardData["now"]>({ activeLeaseCount: 678 }) });
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockResolvedValue({ data: dashboardData });

    const { result } = setupQuery(() => useDashboardData(), { services: { publicConsoleApiHttpClient: () => httpClient } });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(dashboardData);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(ApiUrlService.dashboardData());
  });
});
