import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import type { GpuVendor } from "@src/types/gpu";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import { ProviderSearchInput } from "./ProviderSearchInput/ProviderSearchInput";
import type { DEPENDENCIES } from "./MarketplacePane";
import { MarketplacePane } from "./MarketplacePane";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("passes the spec's GPU count to the table", () => {
    const { MarketplaceProvidersTable } = setup({ gpuCount: 8, offers: [buildOffer()] });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ gpuCount: 8 }), expect.anything());
  });

  it("passes a zero GPU count for a CPU-only spec", () => {
    const { MarketplaceProvidersTable } = setup({ gpuCount: 0, offers: [buildOffer()] });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ gpuCount: 0 }), expect.anything());
  });

  it("passes the gpu catalog to the table so offered models read by their display names", () => {
    const gpuVendors: GpuVendor[] = [{ name: "nvidia", models: [{ name: "rtx4090", displayName: "RTX 4090", memory: [], interface: [] }] }];
    const { MarketplaceProvidersTable } = setup({ gpuVendors, offers: [buildOffer()] });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ gpuVendors }), expect.anything());
  });

  it("hides provider links from the table until the user is onboarded", () => {
    const { MarketplaceProvidersTable } = setup({ isOnboarded: false, offers: [buildOffer()] });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ showProviderLink: false }), expect.anything());
  });

  it("allows provider selection only while quoting", () => {
    const { MarketplaceProvidersTable } = setup({ phase: "quoting", offers: [buildOffer()] });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ isSelectable: true }), expect.anything());
  });

  it("blocks provider selection while the deployment is being created", () => {
    const { MarketplaceProvidersTable } = setup({ phase: "creating", offers: [buildOffer()] });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ isSelectable: false }), expect.anything());
  });

  it("scopes the GPU count to the placement it renders bids for", () => {
    const { useDeploymentGpuCount } = setup({ selectedPlacementId: "placement-2", offers: [buildOffer()] });

    expect(useDeploymentGpuCount).toHaveBeenCalledWith("placement-2");
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

  it("shows a message and no table when the spec is invalid", () => {
    const { MarketplaceProvidersTable } = setup({ isInvalid: true });

    expect(screen.getByText("No providers to show yet")).toBeInTheDocument();
    expect(screen.getByText("Settings to fix")).toBeInTheDocument();
    expect(MarketplaceProvidersTable).not.toHaveBeenCalled();
  });

  it.each([
    { phase: "creating", title: "Creating your deployment", description: "Providers start bidding as soon as your deployment is created." },
    {
      phase: "quoting",
      title: "Waiting for bids",
      description: "The providers below can host this placement and are sending their bids. You can pick one as soon as its bid arrives."
    }
  ] as const)("says what is happening while the $phase deployment waits for its first bid", ({ phase, title, description }) => {
    const { MarketplaceProvidersTable } = setup({ phase, offers: [buildOffer({ offerState: "searching" })] });

    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(screen.getByRole("status")).toHaveTextContent(description);
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ isBusy: true }), expect.anything());
  });

  it("stops waiting once a bid arrives for the placement", () => {
    const { MarketplaceProvidersTable } = setup({
      phase: "quoting",
      offers: [buildOffer({ offerState: "searching" }), buildOffer({ offerState: "submitted" })]
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ isBusy: false }), expect.anything());
  });

  it.each(["creating", "quoting"] as const)("shows no waiting notice while the %s deployment has no provider to wait on", phase => {
    const { MarketplaceProvidersTable } = setup({ phase, offers: [] });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ isBusy: false }), expect.anything());
  });

  it("shows no waiting notice while the deployment is still being configured", () => {
    setup({ phase: "configuring", offers: [buildOffer({ offerState: "searching" })] });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
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

  it("passes the active placement's selection and an onSelect bound to that placement to the table", async () => {
    const onSelectProvider = vi.fn();
    const { user } = setup({ selectedPlacementId: "placement-1", selectedBidId: "akash1a/1/1/1", onSelectProvider });
    await user.click(screen.getByRole("button", { name: "selected" }));
    expect(onSelectProvider).toHaveBeenCalledWith("placement-1", "NEW");
  });

  function buildOffer(overrides: Partial<PlacementOffer> = {}): PlacementOffer {
    return { ...buildScreenedProvider(), offerState: "searching", ...overrides };
  }

  it("explains an empty provider list by architecture when the spec asks for one", () => {
    const { MarketplaceProvidersTable } = setup({ requestedCpuArch: "arm64" });

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(
      expect.objectContaining({ emptyMessage: "No arm64 providers matched this configuration." }),
      expect.anything()
    );
  });

  it("leaves the empty message generic when the spec asks for no architecture", () => {
    const { MarketplaceProvidersTable } = setup({});

    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ emptyMessage: undefined }), expect.anything());
  });

  it("scopes the requested architecture to the placement it renders bids for", () => {
    const { useDeploymentCpuArch } = setup({ selectedPlacementId: "placement-2" });

    expect(useDeploymentCpuArch).toHaveBeenCalledWith("placement-2");
  });

  describe("expanded", () => {
    it("titles the marketplace without the pane number and shows the placement chips", () => {
      setup({ variant: "expanded", chips: <span>placement chips</span> });

      expect(screen.getByRole("heading", { name: "Compute Marketplace" })).toBeInTheDocument();
      expect(screen.getByText("placement chips")).toBeInTheDocument();
    });

    it("lets rows select their offer", () => {
      const { MarketplaceProvidersTable } = setup({ variant: "expanded" });

      expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ selectOnRowClick: true }), expect.anything());
    });

    it("clears the search when it moves to another placement", () => {
      const { clear, rerender } = setup({ variant: "expanded", selectedPlacementId: "placement-1" });

      rerender({ selectedPlacementId: "placement-2" });

      expect(clear).toHaveBeenCalled();
    });

    it("ignores a selection made right after it moved to another placement, which would be a double click", () => {
      vi.useFakeTimers();
      const onSelectProvider = vi.fn();
      const { rerender } = setup({ variant: "expanded", selectedPlacementId: "placement-1", onSelectProvider });
      rerender({ selectedPlacementId: "placement-2" });

      fireEvent.click(screen.getByRole("button", { name: "select" }));
      expect(onSelectProvider).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(400));
      fireEvent.click(screen.getByRole("button", { name: "select" }));

      expect(onSelectProvider).toHaveBeenCalledWith("placement-2", "NEW");
    });
  });

  it("keeps the numbered pane title and the select buttons in the three pane layout", () => {
    const { MarketplaceProvidersTable, clear, rerender } = setup({ selectedPlacementId: "placement-1" });

    rerender({ selectedPlacementId: "placement-2" });

    expect(screen.getByRole("heading", { name: "3. Compute Marketplace" })).toBeInTheDocument();
    expect(MarketplaceProvidersTable).toHaveBeenCalledWith(expect.objectContaining({ selectOnRowClick: false }), expect.anything());
    expect(clear).not.toHaveBeenCalled();
  });

  function setup(
    input: {
      sdl?: string;
      placementName?: string;
      region?: string;
      phase?: DeploymentFlowPhase;
      dseq?: string | null;
      offers?: PlacementOffer[];
      filteredProviders?: PlacementOffer[];
      isLoading?: boolean;
      isError?: boolean;
      isInvalid?: boolean;
      isSearchActive?: boolean;
      gpuCount?: number;
      requestedCpuArch?: "amd64" | "arm64";
      isOnboarded?: boolean;
      gpuVendors?: GpuVendor[];
      selectedPlacementId?: string;
      selectedBidId?: string;
      onSelectProvider?: (placementId: string, bidId: string) => void;
      variant?: "pane" | "expanded";
      chips?: ReactNode;
    } = {}
  ) {
    const clear = vi.fn();
    const usePlacementOffers = vi.fn(() => ({
      offers: input.offers ?? [],
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false,
      isInvalid: input.isInvalid ?? false
    }));
    const useProviderSearch = vi.fn((offers: PlacementOffer[]) => ({
      query: "",
      setQuery: vi.fn(),
      clear,
      filteredProviders: input.filteredProviders ?? offers,
      isSearchActive: input.isSearchActive ?? false
    }));
    const MarketplaceProvidersTable = vi.fn(({ selectedBidId, onSelect }: Parameters<typeof DEPENDENCIES.MarketplaceProvidersTable>[0]) => (
      <button type="button" onClick={() => onSelect?.("NEW")}>
        {selectedBidId ? "selected" : "select"}
      </button>
    ));
    const useDeploymentGpuCount = vi.fn(() => input.gpuCount ?? 0);
    const useDeploymentCpuArch = vi.fn(() => input.requestedCpuArch);
    const dependencies: typeof DEPENDENCIES = {
      usePlacementOffers: usePlacementOffers as never,
      useProviderSearch: useProviderSearch as never,
      MarketplaceProvidersTable: MarketplaceProvidersTable as never,
      ProviderSearchInput,
      useDeploymentGpuCount,
      useDeploymentCpuArch,
      useIsOnboarded: () => input.isOnboarded ?? true,
      useGpuModels: () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>(), { data: input.gpuVendors }),
      InvalidSpecReasons: () => <p>Settings to fix</p>
    };
    const user = userEvent.setup();
    const onSelectProvider = input.onSelectProvider ?? vi.fn();
    const pane = (overrides: { selectedPlacementId?: string }) => (
      <MarketplacePane
        sdl={input.sdl ?? ""}
        placementName={input.placementName ?? "dcloud"}
        region={input.region}
        phase={input.phase ?? "configuring"}
        dseq={input.dseq ?? null}
        selectedPlacementId={overrides.selectedPlacementId ?? input.selectedPlacementId ?? "placement-1"}
        selectedBidId={input.selectedBidId}
        onSelectProvider={onSelectProvider}
        variant={input.variant}
        chips={input.chips}
        dependencies={dependencies}
      />
    );

    const rendered = render(pane({}));
    return {
      usePlacementOffers,
      useProviderSearch,
      MarketplaceProvidersTable,
      useDeploymentGpuCount,
      useDeploymentCpuArch,
      user,
      clear,
      rerender: (overrides: { selectedPlacementId?: string }) => rendered.rerender(pane(overrides))
    };
  }
});
