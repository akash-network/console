import { describe, expect, it, vi } from "vitest";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import type { DEPENDENCIES } from "./MarketplacePane";
import { MarketplacePane } from "./MarketplacePane";

import { render, screen } from "@testing-library/react";

describe("MarketplacePane", () => {
  it("screens the given placement using the current sdl", () => {
    const { useScreenedProviders } = setup({ sdl: "version: 2.0", placementName: "dcloud" });

    expect(useScreenedProviders).toHaveBeenCalledWith({ sdl: "version: 2.0", placementName: "dcloud" });
  });

  it("shows the placement name in the header", () => {
    setup({ placementName: "dcloud" });

    expect(screen.getByText("• dcloud")).toBeInTheDocument();
  });

  it("passes screened providers and loading state to the table", () => {
    const providers = [makeProvider()];
    const { MarketplaceProvidersTable } = setup({ providers, isLoading: false });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ providers, isLoading: false }), expect.anything());
  });

  it("renders an error message and no table when the query fails with no data", () => {
    const { MarketplaceProvidersTable } = setup({ isError: true });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(MarketplaceProvidersTable).not.toHaveBeenCalled();
  });

  it("keeps the table when a refetch fails but providers are still cached", () => {
    const providers = [makeProvider()];
    const { MarketplaceProvidersTable } = setup({ isError: true, providers });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ providers }), expect.anything());
  });

  function makeProvider(): ScreenedProvider {
    return { owner: "akash1a", hostUri: "https://a.example:8443", isAudited: true, location: "us-west", createdAt: "2026-01-01T00:00:00.000Z" };
  }

  function setup(input: { sdl?: string; placementName?: string; providers?: ScreenedProvider[]; isLoading?: boolean; isError?: boolean } = {}) {
    const useScreenedProviders = vi.fn(() => ({
      providers: input.providers ?? [],
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false
    }));
    const MarketplaceProvidersTable = vi.fn(() => <div data-testid="marketplace-table-mock" />);
    const dependencies: typeof DEPENDENCIES = {
      useScreenedProviders: useScreenedProviders as never,
      MarketplaceProvidersTable: MarketplaceProvidersTable as never
    };

    render(<MarketplacePane sdl={input.sdl ?? ""} placementName={input.placementName ?? "dcloud"} dependencies={dependencies} />);
    return { useScreenedProviders, MarketplaceProvidersTable };
  }
});
