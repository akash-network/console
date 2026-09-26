import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { MAX_PROVIDERS_PER_ADDRESS_LOOKUP, useProvidersByAddress } from "./useProvidersQuery";

import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useProvidersByAddress.name, () => {
  it("looks providers up by their sorted, deduplicated addresses", async () => {
    const { result, listProviders } = setup({ addresses: ["akash1bbb", "akash1aaa", "akash1bbb"], providers: [{ owner: "akash1aaa" }] });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(listProviders).toHaveBeenCalledWith({ addresses: "akash1aaa,akash1bbb" });
    expect(result.current.data).toEqual([{ owner: "akash1aaa" }]);
  });

  it("caps a lookup at the api's address limit", async () => {
    const addresses = Array.from({ length: MAX_PROVIDERS_PER_ADDRESS_LOOKUP + 5 }, (_, index) => `akash1${String(index).padStart(3, "0")}`);
    const { listProviders } = setup({ addresses });

    await vi.waitFor(() => {
      expect(listProviders).toHaveBeenCalledWith({ addresses: addresses.slice(0, MAX_PROVIDERS_PER_ADDRESS_LOOKUP).join(",") });
    });
  });

  it("does not look anything up without an address", () => {
    const { result, listProviders } = setup({ addresses: [] });

    expect(result.current.fetchStatus).toBe("idle");
    expect(listProviders).not.toHaveBeenCalled();
  });

  function setup(input: { addresses: string[]; providers?: Array<{ owner: string }> }) {
    const listProviders = vi.fn().mockResolvedValue(input.providers ?? []);
    const api = createProxy({ v1: { listProviders } }) as unknown as ApiService;
    const view = setupQuery(() => useProvidersByAddress(input.addresses), { services: { api: () => api } });
    return { ...view, listProviders };
  }
});
