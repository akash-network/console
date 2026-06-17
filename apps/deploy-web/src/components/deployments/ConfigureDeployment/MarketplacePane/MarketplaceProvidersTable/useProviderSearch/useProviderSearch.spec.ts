import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProviderSearch } from "./useProviderSearch";

import { act, renderHook } from "@testing-library/react";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe(useProviderSearch.name, () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns all providers and is inactive with an empty query", () => {
    const { providers, result } = setup();

    expect(result.current.filteredProviders).toEqual(providers);
    expect(result.current.isSearchActive).toBe(false);
  });

  it("filters by organization name, case-insensitively, after the debounce", () => {
    const akash = buildScreenedProvider({ organization: "Akash Org", hostUri: "https://a.example:8443" });
    const other = buildScreenedProvider({ organization: "Other Co", hostUri: "https://b.example:8443" });
    const { result } = setup({ providers: [akash, other] });

    act(() => result.current.setQuery("akash"));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.filteredProviders).toEqual([akash]);
    expect(result.current.isSearchActive).toBe(true);
  });

  it("filters by raw host URI when organization is absent", () => {
    const match = buildScreenedProvider({ organization: null, hostUri: "https://needle.example:8443" });
    const miss = buildScreenedProvider({ organization: null, hostUri: "https://other.example:8443" });
    const { result } = setup({ providers: [match, miss] });

    act(() => result.current.setQuery("NEEDLE"));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.filteredProviders).toEqual([match]);
  });

  it("does not apply the query until the debounce elapses", () => {
    const a = buildScreenedProvider({ organization: "Aaa" });
    const b = buildScreenedProvider({ organization: "Bbb" });
    const { result } = setup({ providers: [a, b] });

    act(() => result.current.setQuery("aaa"));
    expect(result.current.filteredProviders).toHaveLength(2);

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.filteredProviders).toEqual([a]);
  });

  it("clears immediately and restores the full list", () => {
    const a = buildScreenedProvider({ organization: "Aaa" });
    const b = buildScreenedProvider({ organization: "Bbb" });
    const { providers, result } = setup({ providers: [a, b] });

    act(() => result.current.setQuery("aaa"));
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.filteredProviders).toEqual([a]);

    act(() => result.current.clear());

    expect(result.current.filteredProviders).toEqual(providers);
    expect(result.current.isSearchActive).toBe(false);
  });

  function setup(input: { providers?: ReturnType<typeof buildScreenedProvider>[] } = {}) {
    const providers = input.providers ?? [buildScreenedProvider(), buildScreenedProvider()];
    const { result } = renderHook(() => useProviderSearch(providers));
    return { providers, result };
  }
});
