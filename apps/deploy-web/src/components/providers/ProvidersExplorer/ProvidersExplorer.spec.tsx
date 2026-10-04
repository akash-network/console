import type { ComponentProps } from "react";
import { useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GlobeCluster } from "@src/components/providers/ProvidersGlobe/clusterProviders";
import type { ApiProviderList, ApiProviderLocation, StatsItem } from "@src/types/provider";
import { DEPENDENCIES, ProvidersExplorer } from "./ProvidersExplorer";
import { DEFAULT_FILTERS } from "./useProvidersExplorerModel";

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type GlobeProps = ComponentProps<typeof DEPENDENCIES.ProvidersGlobe>;

describe("ProvidersExplorer", () => {
  it("puts a pin on the globe for each located provider", () => {
    const { globe } = setup({
      locations: [
        createLocation({ owner: "akash1located", ipLat: "38.6", ipLon: "-90.2", ipRegion: "Missouri", ipCountryCode: "US" }),
        createLocation({ owner: "akash1nowhere", ipLat: null, ipLon: null })
      ]
    });

    expect(globe.props().providers).toEqual([{ id: "akash1located", lat: 38.6, lng: -90.2, location: "Missouri, US", gpuCount: 0, vcpuCount: 8 }]);
  });

  it("lists every provider at a picked pin and turns the globe to it", () => {
    const { globe } = setup({
      locations: [createLocation({ owner: "akash1first", name: "provider.first.com" }), createLocation({ owner: "akash1second", name: "provider.second.com" })]
    });

    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1first", "akash1second"], label: "Missouri, US", lat: 38.6, lng: -90.2 })));

    const panel = screen.getByRole("complementary", { name: "Missouri, US" });
    expect(within(panel).getByRole("button", { name: /provider\.first\.com/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /provider\.second\.com/ })).toBeInTheDocument();
    expect(globe.controls.focus).toHaveBeenCalledExactlyOnceWith(38.6, -90.2, 2.6);
  });

  it("opens a picked pin's only provider straight away", () => {
    const { globe } = setup({ locations: [createLocation({ owner: "akash1alone", name: "provider.alone.com" })] });

    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1alone"] })));

    expect(screen.getByRole("complementary", { name: "Provider provider.alone.com" })).toBeInTheDocument();
    expect(globe.props().selectedId).toBe("akash1alone");
  });

  it("opens a provider picked from a pin's list and turns the globe to it", async () => {
    const { globe } = setup({
      locations: [
        createLocation({ owner: "akash1first", name: "provider.first.com", ipLat: "1", ipLon: "2" }),
        createLocation({ owner: "akash1second", name: "provider.second.com" })
      ]
    });
    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1first", "akash1second"] })));
    globe.controls.focus.mockClear();

    await userEvent.click(screen.getByRole("button", { name: /provider\.first\.com/ }));

    expect(screen.getByRole("complementary", { name: "Provider provider.first.com" })).toBeInTheDocument();
    expect(globe.controls.focus).toHaveBeenCalledExactlyOnceWith(1, 2, 2.35);

    await userEvent.click(screen.getByRole("button", { name: "Back to this location" }));

    expect(screen.getByRole("list", { name: "Providers at this location" })).toBeInTheDocument();
  });

  it("opens a provider's summary from its table row and turns the globe to it", async () => {
    const provider = createListedProvider({ owner: "akash1row", name: "provider.row.com", ipLat: "50.1", ipLon: "8.7" });
    const { globe } = setup({ providers: [provider] });

    await userEvent.click(screen.getByRole("button", { name: "provider.row.com" }));

    expect(screen.getByRole("complementary", { name: "Provider provider.row.com" })).toBeInTheDocument();
    expect(globe.props().selectedId).toBe("akash1row");
    expect(globe.controls.focus).toHaveBeenCalledExactlyOnceWith(50.1, 8.7, 2.35);
  });

  it("opens an unlocated provider's summary without turning the globe", async () => {
    const { globe } = setup({ providers: [createListedProvider({ owner: "akash1row", name: "provider.row.com", ipLat: "", ipLon: "" })] });

    await userEvent.click(screen.getByRole("button", { name: "provider.row.com" }));

    expect(screen.getByRole("complementary", { name: "Provider provider.row.com" })).toBeInTheDocument();
    expect(globe.controls.focus).not.toHaveBeenCalled();
  });

  it("closes the panel and turns the globe back to its resting view", async () => {
    const { globe } = setup({ locations: [createLocation({ owner: "akash1alone" })] });
    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1alone"] })));

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(globe.controls.resetView).toHaveBeenCalledTimes(1);
  });

  it("adds the provider in the panel to the favorites", async () => {
    const { globe, model } = setup({ locations: [createLocation({ owner: "akash1alone" })] });
    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1alone"] })));

    await userEvent.click(within(screen.getByRole("complementary")).getByRole("button", { name: "Add to favorites" }));

    expect(model.toggleFavorite).toHaveBeenCalledExactlyOnceWith("akash1alone");
  });

  it("moves the globe aside while the panel is open on wide screens", () => {
    const { globe } = setup({ locations: [createLocation({ owner: "akash1alone" })] });

    expect(globe.props().shiftX).toBe(0);
    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1alone"] })));

    expect(globe.props().shiftX).toBe(-0.42);
  });

  it("zooms, resets and replays the intro from the globe's controls", async () => {
    const { globe } = setup({});
    act(() => globe.props().onZoomChange(0.5));

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset view" }));
    await userEvent.click(screen.getByRole("button", { name: "Replay intro" }));

    expect(globe.controls.zoomBy).toHaveBeenNthCalledWith(1, -0.42);
    expect(globe.controls.zoomBy).toHaveBeenNthCalledWith(2, 0.42);
    expect(globe.controls.resetView).toHaveBeenCalledTimes(1);
    expect(globe.props().introKey).toBe(1);
  });

  it("can't zoom past the closest or the widest view", () => {
    const { globe } = setup({});

    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    act(() => globe.props().onZoomChange(1));

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    expect(screen.getByText("Provider view · drag to spin")).toBeInTheDocument();
  });

  it.each([
    [0.1, "Regional view"],
    [0.4, "Metro view"]
  ])("names the zoom level %s the %s", (zoomLevel, label) => {
    const { globe } = setup({});

    act(() => globe.props().onZoomChange(zoomLevel));

    expect(screen.getByText(`${label} · drag to spin`)).toBeInTheDocument();
  });

  it("steps the globe back once its intro settles, until the pointer comes over it", () => {
    const { globe } = setup({});

    expect(globe.props().dim).toBe(false);
    act(() => globe.props().onIntroDone());
    expect(globe.props().dim).toBe(true);

    fireEvent.mouseEnter(screen.getByRole("region", { name: "Provider map" }));
    expect(globe.props().dim).toBe(false);

    fireEvent.mouseLeave(screen.getByRole("region", { name: "Provider map" }));
    expect(globe.props().dim).toBe(true);
  });

  it("describes the pin under the pointer", () => {
    const { globe } = setup({});

    act(() => globe.props().onHover(createCluster({ providerIds: ["akash1a", "akash1b"], gpuCount: 8, label: "Missouri, US" })));

    expect(screen.getByText("Missouri, US")).toBeInTheDocument();
    expect(screen.getByText("2 providers · 8 GPUs · click to open")).toBeInTheDocument();

    act(() => globe.props().onHover(createCluster({ providerIds: ["akash1a"], gpuCount: 0, label: "Hesse, DE" })));

    expect(screen.getByText("1 provider · click to open")).toBeInTheDocument();
  });

  it("explains the globe can't be shown and keeps the providers listed", () => {
    const { globe } = setup({ providers: [createListedProvider({ name: "provider.listed.com" })] });

    act(() => globe.props().onUnavailable());

    expect(screen.getByText("The globe can't be shown in this browser. The providers are listed below.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "provider.listed.com" })).toBeInTheDocument();
  });

  it("skips the intro and its replay when the user prefers reduced motion", () => {
    const { globe } = setup({ prefersReducedMotion: true });

    expect(globe.props().playIntro).toBe(false);
    expect(screen.queryByRole("button", { name: "Replay intro" })).not.toBeInTheDocument();
  });

  it("draws the globe for the dark theme", () => {
    const { globe } = setup({ theme: "dark" });

    expect(globe.props().theme).toBe("dark");
  });

  it("counts the located providers and their countries", () => {
    setup({
      locations: [
        createLocation({ owner: "akash1a", ipCountryCode: "US" }),
        createLocation({ owner: "akash1b", ipCountryCode: "US" }),
        createLocation({ owner: "akash1c", ipCountryCode: "DE" })
      ]
    });

    expect(screen.getByText("3 providers · 2 countries")).toBeInTheDocument();
  });

  it("searches as the user types", async () => {
    const { model } = setup({});

    await userEvent.type(screen.getByRole("textbox", { name: "Search providers" }), "e");

    expect(model.changeSearch).toHaveBeenCalledWith("e");
  });

  it("clears the search", async () => {
    const { model } = setup({ search: "europlots" });

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(model.changeSearch).toHaveBeenCalledExactlyOnceWith("");
  });

  it("puts the region and GPU filters in the table's column headers on wide screens", () => {
    setup({});

    expect(within(screen.getByRole("columnheader", { name: "Region" })).getByRole("button", { name: "Filter by region" })).toBeInTheDocument();
    expect(within(screen.getByRole("columnheader", { name: "GPU" })).getByRole("button", { name: "Filter by gpu" })).toBeInTheDocument();
  });

  it("moves the search and the filters above the table on narrow screens", () => {
    setup({ isWide: false });

    expect(screen.getAllByRole("textbox", { name: "Search providers" })).toHaveLength(1);
    expect(screen.queryByRole("columnheader", { name: "Region" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter by region" })).toBeInTheDocument();
  });

  it("covers the whole map with the panel on narrow screens and keeps the globe centered", () => {
    const { globe } = setup({ isWide: false, locations: [createLocation({ owner: "akash1alone" })] });

    act(() => globe.props().onPick(createCluster({ providerIds: ["akash1alone"] })));

    expect(globe.props().shiftX).toBe(0);
    expect(screen.queryByRole("button", { name: "Zoom in" })).not.toBeInTheDocument();
  });

  it("passes the picked regions and GPU filters to the model", async () => {
    const { model } = setup({ regionOptions: [{ value: "eu-central", count: 3 }], gpuModelOptions: [{ value: "h100", count: 2 }] });

    await userEvent.click(screen.getByRole("button", { name: "Filter by region" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /EU Central/ }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Filter by gpu" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /H100/ }));

    expect(model.updateFilters).toHaveBeenNthCalledWith(1, { regions: ["eu-central"] });
    expect(model.updateFilters).toHaveBeenNthCalledWith(2, { gpuModels: ["h100"] });
  });

  it("switches the Active, Audited and Favorites filters", async () => {
    const { model } = setup({});

    expect(screen.getByRole("button", { name: "Active" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Active" }));
    await userEvent.click(screen.getByRole("button", { name: "Audited" }));
    await userEvent.click(screen.getByRole("button", { name: "Favorites" }));

    expect(model.updateFilters).toHaveBeenNthCalledWith(1, { isActiveOnly: false });
    expect(model.updateFilters).toHaveBeenNthCalledWith(2, { isAuditedOnly: false });
    expect(model.updateFilters).toHaveBeenNthCalledWith(3, { isFavoritesOnly: true });
  });

  it("titles the list by whether it is narrowed and offers to clear the filters", async () => {
    const { model } = setup({ hasFilters: true, matchingProviderCount: 1 });

    expect(screen.getByRole("heading", { name: "Matching providers" })).toBeInTheDocument();
    expect(screen.getByText("1 provider")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(model.clearFilters).toHaveBeenCalledTimes(1);
  });

  it("titles the full list and counts its providers", () => {
    setup({ matchingProviderCount: 33 });

    expect(screen.getByRole("heading", { name: "All providers" })).toBeInTheDocument();
    expect(screen.getByText("33 providers")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("offers a retry when the map can't load", async () => {
    const { model } = setup({ hasFailedToLoadLocations: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Couldn't load the provider map.")).toBeInTheDocument();
    expect(model.retryLocations).toHaveBeenCalledTimes(1);
  });

  it("shows the table's failed state with its own retry", async () => {
    const { model } = setup({ hasLoadedProviders: false, hasFailedToLoadProviders: true });

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Couldn't load providers.")).toBeInTheDocument();
    expect(model.retryProviders).toHaveBeenCalledTimes(1);
  });

  function createStats(gpus = 0): ApiProviderList["stats"] {
    const item = (total: number): StatsItem => ({ active: 0, available: total, pending: 0, total });
    return { cpu: item(8000), gpu: item(gpus), memory: item(16e9), storage: { ephemeral: item(1e11), persistent: item(0), total: item(1e11) } };
  }

  function createLocation(
    overrides: Partial<Omit<ApiProviderLocation, "ipLat" | "ipLon">> & { ipLat?: string | null; ipLon?: string | null }
  ): ApiProviderLocation {
    return Object.assign(mock<ApiProviderLocation>(), {
      owner: "akash1provider",
      name: "provider.example.com",
      hostUri: "https://provider.example.com:8443",
      ipRegion: "Missouri",
      ipCountryCode: "US",
      ipLat: "38.6",
      ipLon: "-90.2",
      isAudited: true,
      locationRegion: "na-us-midwest",
      uptime30d: 0.99,
      gpuModels: [],
      stats: createStats(),
      ...overrides
    });
  }

  function createListedProvider(overrides: Partial<ApiProviderList>): ApiProviderList {
    return Object.assign(mock<ApiProviderList>(), {
      owner: "akash1listed",
      name: "provider.listed.com",
      hostUri: "https://provider.listed.com:8443",
      ipRegion: "Hesse",
      ipCountryCode: "DE",
      ipLat: "50.1",
      ipLon: "8.7",
      isAudited: true,
      locationRegion: "eu-central",
      uptime30d: 0.99,
      gpuModels: [],
      stats: createStats(),
      ...overrides
    });
  }

  function createCluster(overrides: Partial<GlobeCluster>): GlobeCluster {
    return { id: "cluster-1", lat: 38.6, lng: -90.2, providerIds: [], gpuCount: 0, label: "Missouri, US", ...overrides };
  }

  function createGlobe() {
    const controls = { zoomBy: vi.fn(), resetView: vi.fn(), focus: vi.fn() };
    let latestProps: GlobeProps | undefined;
    const ProvidersGlobe = (props: GlobeProps) => {
      latestProps = props;
      useImperativeHandle(props.controlsRef, () => controls, []);
      return <div>globe</div>;
    };
    return {
      ProvidersGlobe,
      controls,
      props: () => latestProps as GlobeProps
    };
  }

  function setup(input: {
    locations?: ApiProviderLocation[];
    providers?: ApiProviderList[];
    search?: string;
    hasFilters?: boolean;
    matchingProviderCount?: number;
    hasLoadedProviders?: boolean;
    hasFailedToLoadProviders?: boolean;
    hasFailedToLoadLocations?: boolean;
    regionOptions?: { value: string; count: number }[];
    gpuModelOptions?: { value: string; count: number }[];
    isWide?: boolean;
    prefersReducedMotion?: boolean;
    theme?: string;
  }) {
    const providers = input.providers ?? [];
    const model = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProvidersExplorerModel>>(), {
      search: input.search ?? "",
      changeSearch: vi.fn(),
      filters: DEFAULT_FILTERS,
      updateFilters: vi.fn(),
      clearFilters: vi.fn(),
      hasFilters: !!input.hasFilters,
      pageIndex: 0,
      changePageIndex: vi.fn(),
      pageCount: 1,
      matchingProviderCount: input.matchingProviderCount ?? providers.length,
      providers,
      hasLoadedProviders: input.hasLoadedProviders ?? true,
      isLoadingProviders: false,
      hasFailedToLoadProviders: !!input.hasFailedToLoadProviders,
      retryProviders: vi.fn(),
      locations: input.locations ?? [],
      isLoadingLocations: false,
      hasFailedToLoadLocations: !!input.hasFailedToLoadLocations,
      retryLocations: vi.fn(),
      matchingLocationIds: null,
      regionOptions: input.regionOptions ?? [],
      gpuModelOptions: input.gpuModelOptions ?? [],
      networkStats: { availableGpuCount: 60, activeProviderCount: 59, availableVcpuCount: 8868, activeLeaseCount: 678, averageUptime30d: 0.945 },
      favoriteProviders: [],
      toggleFavorite: vi.fn()
    });
    const globe = createGlobe();
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      useProvidersExplorerModel: () => model,
      useTheme: () => input.theme ?? "light",
      useMediaQuery: () => input.isWide ?? true,
      useReducedMotion: () => input.prefersReducedMotion ?? false,
      ProvidersGlobe: globe.ProvidersGlobe
    };

    render(<ProvidersExplorer dependencies={dependencies} />);

    return { model, globe };
  }
});
