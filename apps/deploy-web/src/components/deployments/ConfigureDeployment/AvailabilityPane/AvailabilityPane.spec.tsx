import { describe, expect, it, vi } from "vitest";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { defaultPlacement } from "@src/utils/sdl/data";
import type { GpuAvailability } from "./useGpuAvailability/useGpuAvailability";
import type { GpuQuantityAvailability } from "./useGpuQuantityAvailability/useGpuQuantityAvailability";
import type { DEPENDENCIES } from "./AvailabilityPane";
import { AvailabilityPane } from "./AvailabilityPane";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildScreenedProvider } from "@tests/seeders/screenedProvider";
import { ComponentMock } from "@tests/unit/mocks";

describe(AvailabilityPane.name, () => {
  it("counts the providers that can host the deployment out of the network's providers", () => {
    setup({ eligibleCount: 12, networkCount: 40 });

    expect(screen.getByText("providers can host your deployment").parentElement).toHaveTextContent(/^12\s*providers can host your deployment$/);
    expect(screen.getByText("40 providers on the network")).toBeInTheDocument();
    expect(screen.getByText("eligible")).toBeInTheDocument();
  });

  it("counts a single provider on the network", () => {
    setup({ networkCount: 1 });

    expect(screen.getByText("1 provider on the network")).toBeInTheDocument();
  });

  it("speaks of this placement and names it with its regions once the deployment has several", () => {
    setup({ eligibleCount: 1, placementCount: 2, regions: ["us-west", "eu-west"] });

    expect(screen.getByText("provider can host this placement")).toBeInTheDocument();
    expect(screen.getByText("gpu-pool · us-west, eu-west")).toBeInTheDocument();
  });

  it("names any region for a placement without one", () => {
    setup({ placementCount: 2 });

    expect(screen.getByText("gpu-pool · Any region")).toBeInTheDocument();
  });

  it("screens the active placement", () => {
    const { useScreenedProviders, useGpuAvailability } = setup({ regions: ["us-west"] });

    expect(useScreenedProviders).toHaveBeenCalledWith({ sdl: "the-sdl", placementName: "gpu-pool", regions: ["us-west"] });
    expect(useGpuAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", name: "gpu-pool" }));
  });

  it("shows a loading state while the first screening runs", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("status")).toHaveTextContent("Checking providers…");
    expect(within(screen.getByRole("list", { name: "If you switch model" })).getAllByRole("listitem")[0]).toHaveTextContent("…");
  });

  it("marks the count as updating while a changed spec is screened", () => {
    setup({ isRefreshing: true });

    expect(screen.getByRole("status")).toHaveTextContent("Updating");
  });

  it("explains an invalid spec instead of counting providers", () => {
    setup({ isInvalid: true });

    expect(screen.getByText("No providers to show yet")).toBeInTheDocument();
    expect(screen.getByText("Settings to fix")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "If you switch model" })).not.toBeInTheDocument();
  });

  it("explains a failed screening instead of counting providers", () => {
    setup({ isError: true, eligibleCount: 0 });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check providers right now.");
  });

  it("leaves the network total out until it is known", () => {
    setup({ networkCount: null });

    expect(screen.queryByText(/on the network/)).not.toBeInTheDocument();
  });

  it("lists the current GPU request with the live count, then the busiest models with their free gpus", () => {
    setup({ eligibleCount: 5 });

    const rows = gpuRows();
    expect(screen.getByRole("heading", { name: "GPU availability" })).toBeInTheDocument();
    expect(rows.map(row => row.firstElementChild?.textContent)).toEqual(["No GPUCurrent", "RTX 4090", "H100"]);
    expect(rows.map(describeCounts)).toEqual(["5 providers", "36 free GPUs on 9 providers", "12 free GPUs on 4 providers"]);
    expect(rows.map(row => row.getAttribute("aria-current"))).toEqual(["true", null, null]);
  });

  it("adds up the free gpus of the providers that can host a requested gpu, and lists no gpu last", () => {
    setup({ eligibleCount: 3, gpusPerProvider: 2, networkCount: 20, gpuAvailability: { requestedLabel: "A100", requestsGpu: true, noGpuCount: 12 } });

    const rows = gpuRows();
    expect(rows.map(row => row.firstElementChild?.textContent)).toEqual(["A100Current", "RTX 4090", "H100", "No GPU"]);
    expect(rows.map(describeCounts)).toEqual(["6 free GPUs on 3 providers", "36 free GPUs on 9 providers", "12 free GPUs on 4 providers", "12 providers"]);
  });

  it("shows the bare counts under provider and gpu column labels", () => {
    setup({ eligibleCount: 3, gpusPerProvider: 2, gpuAvailability: { requestedLabel: "A100", requestsGpu: true } });

    const [current] = gpuRows();
    const columnLabels = screen.getByText("GPUs").parentElement!;
    expect(within(columnLabels).getByText("Providers")).toBeInTheDocument();
    expect(within(columnLabels).getByText("If you switch model")).toBeInTheDocument();
    expect(within(current).getByText("3")).toBeInTheDocument();
    expect(within(current).getByText("6")).toBeInTheDocument();
  });

  it("leaves the free gpus of the current request out while screening does not count them", () => {
    setup({ eligibleCount: 3, gpusPerProvider: null, gpuAvailability: { requestedLabel: "A100", requestsGpu: true } });

    const [current] = gpuRows();
    expect(describeCounts(current)).toBe("3 providers");
    expect(within(current).getByText("–")).toBeInTheDocument();
  });

  it("marks the current counts as pending while the first screening runs", () => {
    setup({ isLoading: true, gpuAvailability: { requestedLabel: "A100", requestsGpu: true } });

    const [current] = gpuRows();
    expect(describeCounts(current)).toBe("Checking");
  });

  it("explains that every count keeps the rest of the configuration", () => {
    const { CustomTooltip } = setup({});

    expect(CustomTooltip).toHaveBeenCalledWith(
      expect.objectContaining({
        title:
          "Each row shows how many providers could host this configuration if you switched to that model and kept everything else the same, and how many of those GPUs they have free for it. Each quantity tile does the same for that number of GPUs."
      }),
      expect.anything()
    );
  });

  it("shows other models are being checked until the first of them is counted", () => {
    setup({ gpuAvailability: { isChecking: true, alternatives: [] } });

    expect(screen.getByRole("status")).toHaveTextContent("Checking other models…");
  });

  it("keeps the counted models in place of the check status while the rest are screened", () => {
    setup({ gpuAvailability: { isChecking: true } });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(gpuRows()).toHaveLength(3);
  });

  it("says no other model fits once none of them can host the configuration", () => {
    setup({ gpuAvailability: { alternatives: [], noOtherModelFits: true } });

    expect(screen.getByText("No other GPU model fits this configuration.")).toBeInTheDocument();
  });

  it("says nothing about other models while some of them fit", () => {
    setup({});

    expect(screen.queryByText("No other GPU model fits this configuration.")).not.toBeInTheDocument();
  });

  it("counts the providers at each gpu quantity of the current request and marks the current one", () => {
    const { useGpuQuantityAvailability } = setup({
      gpuAvailability: { requestedLabel: "H100", requestsGpu: true },
      gpuQuantities: [
        { gpuCount: 1, providerCount: 9, isCurrent: false },
        { gpuCount: 2, providerCount: 1, isCurrent: true },
        { gpuCount: 4, providerCount: 0, isCurrent: false },
        { gpuCount: 8, providerCount: null, isCurrent: false }
      ]
    });

    const tiles = within(screen.getByRole("list", { name: "Providers by quantity · H100" })).getAllByRole("listitem");
    expect(tiles.map(tile => tile.textContent)).toEqual(["1× GPU9 providers", "2× GPU1 provider", "4× GPU0 providers", "8× GPU…Checking"]);
    expect(tiles.map(tile => tile.getAttribute("aria-current"))).toEqual([null, "true", null, null]);
    expect(useGpuQuantityAvailability).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", name: "gpu-pool" }));
  });

  it("leaves the quantities out while there is no gpu to count", () => {
    setup({ gpuQuantities: [] });

    expect(screen.queryByText(/Providers by quantity/)).not.toBeInTheDocument();
  });

  it("draws each gpu bar as a share of the network", () => {
    setup({ eligibleCount: 5, networkCount: 20 });

    expect(gpuRows().map(row => row.querySelector<HTMLElement>("[style]")?.style.width)).toEqual(["25%", "45%", "20%"]);
  });

  it("chooses a provider once the deployment is ready", async () => {
    const { onChooseProvider } = setup({ isReady: true });

    await userEvent.click(screen.getByRole("button", { name: "Choose a provider" }));

    expect(onChooseProvider).toHaveBeenCalled();
    expect(screen.queryByText(/Add a container image and hardware/)).not.toBeInTheDocument();
  });

  it("explains what is missing and still lets the choice point at the first problem", async () => {
    const { onChooseProvider } = setup({ isReady: false });

    await userEvent.click(screen.getByRole("button", { name: "Choose a provider" }));

    expect(screen.getByText("Add a container image and hardware to every service to deploy.")).toBeInTheDocument();
    expect(onChooseProvider).toHaveBeenCalled();
  });

  it("holds the provider choice but not the compute request while a request is already being submitted", () => {
    setup({ isReady: true, isSubmitting: true });

    expect(screen.getByRole("button", { name: "Choose a provider" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request compute" })).toBeEnabled();
  });

  it("holds the provider choice and points at the compute request while no provider can host the configuration", () => {
    setup({ isReady: true, hasPlacementWithoutProviders: true });

    expect(screen.getByRole("button", { name: "Choose a provider" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request compute" })).toBeEnabled();
    expect(screen.getByText("No provider can host this configuration right now. Change the resources or request compute.")).toBeInTheDocument();
  });

  it("says which placements no provider can host once the deployment has several", () => {
    setup({ isReady: true, placementCount: 2, hasPlacementWithoutProviders: true });

    expect(screen.getByRole("button", { name: "Choose a provider" })).toBeDisabled();
    expect(screen.getByText("No provider can host every placement right now. Change the resources or request compute.")).toBeInTheDocument();
  });

  it("says nothing about hosting while every placement has a provider", () => {
    setup({ isReady: true, hasPlacementWithoutProviders: false });

    expect(screen.getByRole("button", { name: "Choose a provider" })).toBeEnabled();
    expect(screen.queryByText(/No provider can host/)).not.toBeInTheDocument();
  });

  it("requests compute from beside the provider choice", async () => {
    const { onRequestCompute, onChooseProvider } = setup({ isReady: false });

    await userEvent.click(screen.getByRole("button", { name: "Request compute" }));

    expect(onRequestCompute).toHaveBeenCalled();
    expect(onChooseProvider).not.toHaveBeenCalled();
  });

  it("offers the compute request for what is missing before the provider choice", () => {
    setup({});

    const [requestCompute, chooseProvider] = screen.getAllByRole("button");
    expect(chooseProvider).toHaveAccessibleName("Choose a provider");
    expect(chooseProvider).toHaveAccessibleDescription("Compare live bids yourself");
    expect(requestCompute).toHaveAccessibleName("Request compute");
    expect(requestCompute).toHaveAccessibleDescription("Don't see what you need?");
  });

  function setup(input: {
    eligibleCount?: number;
    networkCount?: number | null;
    placementCount?: number;
    regions?: string[];
    isLoading?: boolean;
    isRefreshing?: boolean;
    isInvalid?: boolean;
    isError?: boolean;
    isReady?: boolean;
    isSubmitting?: boolean;
    gpusPerProvider?: number | null;
    hasPlacementWithoutProviders?: boolean;
    gpuAvailability?: Partial<GpuAvailability>;
    gpuQuantities?: GpuQuantityAvailability[];
  }) {
    const onChooseProvider = vi.fn();
    const onRequestCompute = vi.fn();
    const useScreenedProviders = vi.fn(() => ({
      providers: Array.from({ length: input.eligibleCount ?? 3 }, () => screenedProvider(input.gpusPerProvider === undefined ? 2 : input.gpusPerProvider)),
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false,
      isInvalid: input.isInvalid ?? false,
      isRefreshing: input.isRefreshing ?? false
    }));
    const useGpuAvailability = vi.fn(
      (): GpuAvailability => ({
        requestedLabel: "No GPU",
        requestsGpu: false,
        alternatives: [
          { key: "nvidia/rtx4090", label: "RTX 4090", providerCount: 9, gpuCount: 36 },
          { key: "nvidia/h100", label: "H100", providerCount: 4, gpuCount: 12 }
        ],
        noGpuCount: null,
        isChecking: false,
        noOtherModelFits: false,
        ...input.gpuAvailability
      })
    );
    const useGpuQuantityAvailability = vi.fn((): GpuQuantityAvailability[] => input.gpuQuantities ?? []);
    const CustomTooltip = vi.fn(ComponentMock);
    const dependencies: typeof DEPENDENCIES = {
      useScreenedProviders,
      useNetworkProviderCount: () => ({ count: input.networkCount === undefined ? 20 : input.networkCount, isLoading: false }),
      useGpuAvailability,
      useGpuQuantityAvailability,
      CustomTooltip: CustomTooltip as never,
      InvalidSpecReasons: () => <p>Settings to fix</p>
    };

    render(
      <AvailabilityPane
        sdl="the-sdl"
        placement={{ ...defaultPlacement({ name: "gpu-pool", regions: input.regions }), id: "p1" }}
        placementCount={input.placementCount ?? 1}
        isReady={input.isReady ?? true}
        isSubmitting={input.isSubmitting ?? false}
        hasPlacementWithoutProviders={input.hasPlacementWithoutProviders ?? false}
        onChooseProvider={onChooseProvider}
        onRequestCompute={onRequestCompute}
        dependencies={dependencies}
      />
    );

    return { onChooseProvider, onRequestCompute, useScreenedProviders, useGpuAvailability, useGpuQuantityAvailability, CustomTooltip };
  }
});

function gpuRows() {
  return within(screen.getByRole("list", { name: "If you switch model" })).getAllByRole("listitem");
}

function describeCounts(row: HTMLElement) {
  return within(row).getByText(/providers?$|^Checking$/).textContent;
}

function screenedProvider(availableGpus: number | null): ScreenedProvider {
  if (availableGpus !== null) return buildScreenedProvider({ availableGpus });
  const { availableGpus: _uncounted, ...fromOlderApi } = buildScreenedProvider();
  return fromOlderApi as ScreenedProvider;
}
