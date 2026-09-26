import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderLookupService } from "@src/services/provider-lookup/provider-lookup.service";
import type { ApiProviderList } from "@src/types/provider";
import { useProvidersByAddresses } from "./useProvidersQuery";

import { setupQuery } from "@tests/unit/query-client";

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
