import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { QueryKeys } from "@src/queries/queryKeys";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { BECOME_A_PROVIDER_URL, DEPENDENCIES, ProvidersPage } from "./ProvidersPage";

import { act, render, screen, waitFor } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe("ProvidersPage", () => {
  it("titles the page and links to becoming a provider in a new tab", () => {
    setup();

    expect(screen.getByRole("heading", { level: 1, name: "Providers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Become a provider" })).toHaveAttribute("href", BECOME_A_PROVIDER_URL);
    expect(screen.getByRole("link", { name: "Become a provider" })).toHaveAttribute("target", "_blank");
  });

  it("describes the page for search engines at its canonical address", () => {
    const { dependencies } = setup();

    expect(dependencies.CustomNextSeo).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Providers", url: `${domainName}${UrlService.providers()}` }),
      expect.anything()
    );
  });

  it("does not show the page loading bar while nothing is fetching", () => {
    const { dependencies } = setup();

    expect(dependencies.Layout).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: false, disableContainer: true }), expect.anything());
  });

  it("shows the page loading bar while a provider search is fetching", async () => {
    const { dependencies, startFetching } = setup();

    startFetching(QueryKeys.getProviderSearchKey({ search: "akash", skip: 0, limit: 10 }));

    await waitFor(() => expect(dependencies.Layout).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: true }), expect.anything()));
  });

  it("does not show the page loading bar while only other provider data is fetching", async () => {
    const { dependencies, startFetching, queryClient } = setup();

    startFetching(QueryKeys.getProviderLocationsKey());

    await waitFor(() => expect(queryClient.isFetching()).toBe(1));
    expect(dependencies.Layout).toHaveBeenLastCalledWith(expect.objectContaining({ isLoading: false }), expect.anything());
  });

  function setup() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const dependencies = MockComponents(DEPENDENCIES, { useIsFetching: DEPENDENCIES.useIsFetching });

    render(
      <QueryClientProvider client={queryClient}>
        <ProvidersPage dependencies={dependencies} />
      </QueryClientProvider>
    );

    const startFetching = (queryKey: unknown[]) => {
      act(() => {
        void queryClient.prefetchQuery({ queryKey, queryFn: () => new Promise(() => {}) });
      });
    };

    return { dependencies, queryClient, startFetching };
  }
});
