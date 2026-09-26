import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { useProvidersByAddress } from "./useProvidersQuery";

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
