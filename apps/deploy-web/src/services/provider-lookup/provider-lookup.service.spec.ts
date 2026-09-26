import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
import { MAX_ADDRESSES_PER_REQUEST, ProviderLookupService } from "./provider-lookup.service";

const BASE_API_URL = "https://console-api.example.com";

describe(ProviderLookupService.name, () => {
  it("asks for every address looked up within one tick in a single request", async () => {
    const { service, httpClient } = setup({ knownAddresses: ["akash1first", "akash1second"] });

    const found = await Promise.all([service.findByAddress("akash1first"), service.findByAddress("akash1second")]);

    expect(found.map(provider => provider?.owner)).toEqual(["akash1first", "akash1second"]);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(`${BASE_API_URL}/v1/providers`, { params: { addresses: "akash1first,akash1second" } });
  });

  it("splits a tick's lookups into requests the console API accepts", async () => {
    const addresses = Array.from({ length: MAX_ADDRESSES_PER_REQUEST + 1 }, (_, index) => `akash1provider${index}`);
    const { service, httpClient } = setup({ knownAddresses: addresses });

    await Promise.all(addresses.map(address => service.findByAddress(address)));

    expect(httpClient.get.mock.calls.map(([, config]) => config?.params.addresses.split(",").length)).toEqual([MAX_ADDRESSES_PER_REQUEST, 1]);
  });

  it("asks once for an address looked up twice within one tick", async () => {
    const { service, httpClient } = setup({ knownAddresses: ["akash1first"] });

    const found = await Promise.all([service.findByAddress("akash1first"), service.findByAddress("akash1first")]);

    expect(found.map(provider => provider?.owner)).toEqual(["akash1first", "akash1first"]);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith(`${BASE_API_URL}/v1/providers`, { params: { addresses: "akash1first" } });
  });

  it("resolves an address the console API does not know to null", async () => {
    const { service } = setup({ knownAddresses: [] });

    const found = await service.findByAddress("akash1unknown");

    expect(found).toBeNull();
  });

  it("asks again for an address looked up in a later tick", async () => {
    const { service, httpClient } = setup({ knownAddresses: ["akash1first"] });

    await service.findByAddress("akash1first");
    await service.findByAddress("akash1first");

    expect(httpClient.get).toHaveBeenCalledTimes(2);
  });

  it("rejects every lookup of a request that failed", async () => {
    const { service, httpClient } = setup({ knownAddresses: [] });
    const failure = new Error("Service Unavailable");
    httpClient.get.mockRejectedValue(failure);

    const results = await Promise.allSettled([service.findByAddress("akash1first"), service.findByAddress("akash1second")]);

    expect(results).toEqual([
      { status: "rejected", reason: failure },
      { status: "rejected", reason: failure }
    ]);
  });

  function setup(input: { knownAddresses: string[] }) {
    const httpClient = mock<AxiosInstance>();
    httpClient.get.mockImplementation(async (_url, config) => {
      const requested: string[] = config?.params.addresses.split(",") ?? [];
      return { data: requested.filter(address => input.knownAddresses.includes(address)).map(address => mock<ApiProviderList>({ owner: address })) };
    });
    const service = new ProviderLookupService(httpClient, () => BASE_API_URL);

    return { service, httpClient };
  }
});
