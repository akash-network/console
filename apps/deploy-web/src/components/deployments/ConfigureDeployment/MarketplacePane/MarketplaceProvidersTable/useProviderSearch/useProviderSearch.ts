import { useCallback, useEffect, useMemo, useState } from "react";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";

/** Delay before a typed query is applied; clearing bypasses it. Matches the SDL-sync precedent. */
const SEARCH_DEBOUNCE_MS = 300;

interface UseProviderSearchResult {
  query: string;
  setQuery: (value: string) => void;
  clear: () => void;
  filteredProviders: ScreenedProvider[];
  isSearchActive: boolean;
}

/**
 * Presentation-only narrowing of the screened list by organization name and host URI. The typed
 * query is debounced; an empty query applies immediately so clearing snaps the full list back.
 */
export function useProviderSearch(providers: ScreenedProvider[]): UseProviderSearchResult {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(
    function debounceQuery() {
      if (query === "") {
        setDebouncedQuery("");
        return;
      }
      const timeout = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
      return function cancelDebounce() {
        clearTimeout(timeout);
      };
    },
    [query]
  );

  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const isSearchActive = normalizedQuery.length > 0;

  const filteredProviders = useMemo(
    function filterProviders() {
      if (!isSearchActive) return providers;
      return providers.filter(provider => matchesQuery(provider, normalizedQuery));
    },
    [providers, normalizedQuery, isSearchActive]
  );

  const clear = useCallback(function clearQuery() {
    setQuery("");
  }, []);

  return { query, setQuery, clear, filteredProviders, isSearchActive };
}

/** Case-insensitive substring match against the organization name (when set) and the raw host URI. */
function matchesQuery(provider: ScreenedProvider, normalizedQuery: string): boolean {
  const organization = provider.organization?.toLowerCase() ?? "";
  return organization.includes(normalizedQuery) || provider.hostUri.toLowerCase().includes(normalizedQuery);
}
