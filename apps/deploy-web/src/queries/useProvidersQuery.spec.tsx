import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderLookupService } from "@src/services/provider-lookup/provider-lookup.service";
import type { ApiProviderList } from "@src/types/provider";
import { useProvidersByAddress, useProvidersByAddresses } from "./useProvidersQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProvidersByAddress.name, () => {
  it("looks every distinct address up and merges the answers", async () => {
    const { result, listProviders } = setup({ addresses: ["akash1bbb", "akash1aaa", "akash1bbb"] });

    await vi.waitFor(() => {
      expect(result.current).toEqual(expect.arrayContaining([{ owner: "akash1aaa" }, { owner: "akash1bbb" }]));
    });
    expect(listProviders).toHaveBeenCalledTimes(2);
    expect(listProviders).toHaveBeenCalledWith({ addresses: "akash1aaa" });
    expect(listProviders).toHaveBeenCalledWith({ addresses: "akash1bbb" });
  });

  it("looks up more addresses than the api accepts in a single lookup", async () => {
    const addresses = Array.from({ length: 25 }, (_, index) => `akash1${String(index).padStart(3, "0")}`);
    const { result } = setup({ addresses });

    await vi.waitFor(() => {
      expect(result.current.map(provider => provider.owner).sort()).toEqual(addresses);
    });
  });

  it("keeps an answered address when another address is added", async () => {
    const { result, listProviders, lookUp } = setup({ addresses: ["akash1aaa"] });
    await vi.waitFor(() => {
      expect(result.current).toEqual([{ owner: "akash1aaa" }]);
    });

    lookUp(["akash1aaa", "akash1bbb"]);

    await vi.waitFor(() => {
      expect(result.current).toEqual(expect.arrayContaining([{ owner: "akash1aaa" }, { owner: "akash1bbb" }]));
    });
    expect(listProviders).toHaveBeenCalledTimes(2);
  });

  it("does not look anything up without an address", () => {
    const { result, listProviders } = setup({ addresses: [] });

    expect(result.current).toEqual([]);
    expect(listProviders).not.toHaveBeenCalled();
  });

  function setup(input: { addresses: string[] }) {
    let addresses = input.addresses;
    const listProviders = vi.fn(async ({ addresses: address }: { addresses: string }) => [{ owner: address }]);
    const api = createProxy({ v1: { listProviders } }) as unknown as ApiService;
    const view = setupQuery(() => useProvidersByAddress(addresses), { services: { api: () => api } });
    const lookUp = (nextAddresses: string[]) => {
      addresses = nextAddresses;
      view.rerender();
    };
    return { ...view, listProviders, lookUp };
  }
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
