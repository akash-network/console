import type { UseQueryResult } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { setupQuery } from "../../tests/unit/query-client";
import { useNetworkProviderCount } from "./useNetworkProviderCount";
import type { ScreenedProvider, ScreenedProvidersResponse } from "./useScreenedProviders";
import { buildCatalogScreeningRequest } from "./useScreenedProviders";

import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe(useNetworkProviderCount.name, () => {
  it("counts the providers an empty resource spec screens to, which is every online audited provider", () => {
    const { result, useQuery } = setup({ providers: [buildScreenedProvider(), buildScreenedProvider(), buildScreenedProvider()] });

    expect(result.current).toEqual({ count: 3, isLoading: false });
    expect(useQuery).toHaveBeenCalledWith({ ...buildCatalogScreeningRequest(), timezone: expect.any(String) }, expect.anything());
  });

  it("keeps the count for five minutes and skips refetching when the window regains focus", () => {
    const { useQuery } = setup({});

    expect(useQuery).toHaveBeenCalledWith(expect.anything(), { staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  });

  it("reports no count while the screening loads", () => {
    const { result } = setup({ isLoading: true });

    expect(result.current).toEqual({ count: null, isLoading: true });
  });

  function setup(input: { providers?: ScreenedProvider[]; isLoading?: boolean }) {
    const result = input.isLoading
      ? mock<UseQueryResult<ScreenedProvidersResponse>>({ data: undefined, isLoading: true })
      : mock<UseQueryResult<ScreenedProvidersResponse>>({ data: { providers: input.providers ?? [] }, isLoading: false });
    const useQuery = vi.fn().mockReturnValue(result);
    const api = { v1: { screenProviders: { useQuery } } } as unknown as ReturnType<
      NonNullable<NonNullable<NonNullable<Parameters<typeof setupQuery>[1]>["services"]>["api"]>
    >;
    const view = setupQuery(() => useNetworkProviderCount(), { services: { api: () => api } });
    return { result: view.result, useQuery };
  }
});
