import { describe, expect, it, vi } from "vitest";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import { ProviderSearchInput } from "./ProviderSearchInput/ProviderSearchInput";
import type { DEPENDENCIES } from "./MarketplacePane";
import { MarketplacePane } from "./MarketplacePane";

import { render, screen } from "@testing-library/react";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";

describe(MarketplacePane.name, () => {
  it("reads offers for the current phase, dseq, sdl, placement and region", () => {
    const { usePlacementOffers } = setup({ sdl: "version: 2.0", placementName: "dcloud", region: "na-us-west", phase: "quoting", dseq: "100" });

    expect(usePlacementOffers).toHaveBeenCalledWith({ sdl: "version: 2.0", placementName: "dcloud", region: "na-us-west", phase: "quoting", dseq: "100" });
  });

  it("shows the placement name in the header", () => {
    setup({ placementName: "dcloud" });

    expect(screen.getByText("• dcloud")).toBeInTheDocument();
  });

  it("passes the offers and loading state to the table", () => {
    const offers = [buildOffer()];
    const { MarketplaceProvidersTable } = setup({ offers, isLoading: false });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ providers: offers, isLoading: false }), expect.anything());
  });

  it("renders an error message and no table when offers fail to load with no data", () => {
    const { MarketplaceProvidersTable } = setup({ isError: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(MarketplaceProvidersTable).not.toHaveBeenCalled();
  });

  it("keeps the table when a refetch fails but offers are still cached", () => {
    const offers = [buildOffer()];
    const { MarketplaceProvidersTable } = setup({ isError: true, offers });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ providers: offers }), expect.anything());
  });

  it("renders the provider search input in the header", () => {
    setup({ offers: [buildOffer()] });

    expect(screen.getByRole("searchbox", { name: /search providers/i })).toBeInTheDocument();
  });

  it("passes the filtered offers and search props to the table", () => {
    const offers = [buildOffer(), buildOffer()];
    const filteredProviders = [offers[0]];
    const { MarketplaceProvidersTable } = setup({ offers, filteredProviders, isSearchActive: true });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(
      expect.objectContaining({ providers: filteredProviders, isSearchActive: true, onClearSearch: expect.any(Function) }),
      expect.anything()
    );
  });

  function buildOffer(overrides: Partial<PlacementOffer> = {}): PlacementOffer {
    return { ...buildScreenedProvider(), offerState: "searching", ...overrides };
  }

  function setup(
    input: {
      sdl?: string;
      placementName?: string;
      region?: string;
      phase?: "configuring" | "creating" | "quoting" | "error";
      dseq?: string | null;
      offers?: PlacementOffer[];
      filteredProviders?: PlacementOffer[];
      isLoading?: boolean;
      isError?: boolean;
      isSearchActive?: boolean;
    } = {}
  ) {
    const usePlacementOffers = vi.fn(() => ({
      offers: input.offers ?? [],
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false
    }));
    const useProviderSearch = vi.fn((offers: PlacementOffer[]) => ({
      query: "",
      setQuery: vi.fn(),
      clear: vi.fn(),
      filteredProviders: input.filteredProviders ?? offers,
      isSearchActive: input.isSearchActive ?? false
    }));
    const MarketplaceProvidersTable = vi.fn(() => <div data-testid="marketplace-table-mock" />);
    const dependencies: typeof DEPENDENCIES = {
      usePlacementOffers: usePlacementOffers as never,
      useProviderSearch: useProviderSearch as never,
      MarketplaceProvidersTable: MarketplaceProvidersTable as never,
      ProviderSearchInput
    };

    render(
      <MarketplacePane
        sdl={input.sdl ?? ""}
        placementName={input.placementName ?? "dcloud"}
        region={input.region}
        phase={input.phase ?? "configuring"}
        dseq={input.dseq ?? null}
        dependencies={dependencies}
      />
    );
    return { usePlacementOffers, useProviderSearch, MarketplaceProvidersTable };
  }
});
