import { describe, expect, it, vi } from "vitest";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { ProviderSearchInput } from "./ProviderSearchInput/ProviderSearchInput";
import type { DEPENDENCIES } from "./MarketplacePane";
import { MarketplacePane } from "./MarketplacePane";

import { render, screen } from "@testing-library/react";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe("MarketplacePane", () => {
  it("screens the given placement using the current sdl and region", () => {
    const { useScreenedProviders } = setup({ sdl: "version: 2.0", placementName: "dcloud", region: "na-us-west" });

    expect(useScreenedProviders).toHaveBeenCalledWith({ sdl: "version: 2.0", placementName: "dcloud", region: "na-us-west" });
  });

  it("shows the placement name in the header", () => {
    setup({ placementName: "dcloud" });

    expect(screen.getByText("• dcloud")).toBeInTheDocument();
  });

  it("passes screened providers and loading state to the table", () => {
    const providers = [buildScreenedProvider()];
    const { MarketplaceProvidersTable } = setup({ providers, isLoading: false });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ providers, isLoading: false }), expect.anything());
  });

  it("renders an error message and no table when the query fails with no data", () => {
    const { MarketplaceProvidersTable } = setup({ isError: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(MarketplaceProvidersTable).not.toHaveBeenCalled();
  });

  it("keeps the table when a refetch fails but providers are still cached", () => {
    const providers = [buildScreenedProvider()];
    const { MarketplaceProvidersTable } = setup({ isError: true, providers });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ providers }), expect.anything());
  });

  it("renders the provider search input in the header", () => {
    setup({ providers: [buildScreenedProvider()] });

    expect(screen.getByRole("searchbox", { name: /search providers/i })).toBeInTheDocument();
  });

  it("passes the filtered providers and search props to the table", () => {
    const providers = [buildScreenedProvider(), buildScreenedProvider()];
    const filteredProviders = [providers[0]];
    const { MarketplaceProvidersTable } = setup({ providers, filteredProviders, isSearchActive: true });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(
      expect.objectContaining({ providers: filteredProviders, isSearchActive: true, onClearSearch: expect.any(Function) }),
      expect.anything()
    );
  });

  function setup(
    input: {
      sdl?: string;
      placementName?: string;
      region?: string;
      providers?: ScreenedProvider[];
      filteredProviders?: ScreenedProvider[];
      isLoading?: boolean;
      isError?: boolean;
      isSearchActive?: boolean;
    } = {}
  ) {
    const useScreenedProviders = vi.fn(() => ({
      providers: input.providers ?? [],
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false
    }));
    const useProviderSearch = vi.fn((providers: ScreenedProvider[]) => ({
      query: "",
      setQuery: vi.fn(),
      clear: vi.fn(),
      filteredProviders: input.filteredProviders ?? providers,
      isSearchActive: input.isSearchActive ?? false
    }));
    const MarketplaceProvidersTable = vi.fn(() => <div data-testid="marketplace-table-mock" />);
    const dependencies: typeof DEPENDENCIES = {
      useScreenedProviders: useScreenedProviders as never,
      useProviderSearch: useProviderSearch as never,
      MarketplaceProvidersTable: MarketplaceProvidersTable as never,
      ProviderSearchInput
    };

    render(<MarketplacePane sdl={input.sdl ?? ""} placementName={input.placementName ?? "dcloud"} region={input.region} dependencies={dependencies} />);
    return { useScreenedProviders, useProviderSearch, MarketplaceProvidersTable };
  }
});
