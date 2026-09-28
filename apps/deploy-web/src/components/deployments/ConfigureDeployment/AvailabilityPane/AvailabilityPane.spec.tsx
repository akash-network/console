import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import type { PlacementType } from "@src/types";
import type { DEPENDENCIES } from "./AvailabilityPane";
import { AvailabilityPane } from "./AvailabilityPane";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentMock } from "@tests/unit/mocks";

describe(AvailabilityPane.name, () => {
  it("counts the providers that can host the deployment out of the network's providers", () => {
    setup({ eligibleCount: 12, networkCount: 40 });

    expect(screen.getByText("providers can host your deployment").parentElement).toHaveTextContent(/^12\s*providers can host your deployment$/);
    expect(screen.getByText("40 providers on the network")).toBeInTheDocument();
  });

  it("speaks of this placement and names it once the deployment has several", () => {
    setup({ eligibleCount: 1, placementCount: 2, region: "us-west" });

    expect(screen.getByText("provider can host this placement")).toBeInTheDocument();
    expect(screen.getByText("gpu-pool · us-west")).toBeInTheDocument();
  });

  it("names any region for a placement without one", () => {
    setup({ placementCount: 2 });

    expect(screen.getByText("gpu-pool · Any region")).toBeInTheDocument();
  });

  it("screens the active placement", () => {
    const { useScreenedProviders, useGpuAvailability } = setup({ region: "us-west" });

    expect(useScreenedProviders).toHaveBeenCalledWith({ sdl: "the-sdl", placementName: "gpu-pool", region: "us-west" });
    expect(useGpuAvailability).toHaveBeenCalledWith("p1");
  });

  it("shows a loading state while the first screening runs", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("status")).toHaveTextContent("Checking providers…");
    expect(within(screen.getByRole("list", { name: "If you add a GPU" })).getAllByRole("listitem")[0]).toHaveTextContent("…");
  });

  it("marks the count as updating while a changed spec is screened", () => {
    setup({ isRefreshing: true });

    expect(screen.getByRole("status")).toHaveTextContent("Updating");
  });

  it("explains an invalid spec instead of counting providers", () => {
    setup({ isInvalid: true });

    expect(screen.getByText("No providers to show yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "If you add a GPU" })).not.toBeInTheDocument();
  });

  it("explains a failed screening instead of counting providers", () => {
    setup({ isError: true, eligibleCount: 0 });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check providers right now.");
  });

  it("leaves the network total out until it is known", () => {
    setup({ networkCount: null });

    expect(screen.queryByText(/on the network/)).not.toBeInTheDocument();
  });

  it("lists the current GPU request with the live count, then the busiest models", () => {
    setup({ eligibleCount: 5 });

    const rows = within(screen.getByRole("list", { name: "If you add a GPU" })).getAllByRole("listitem");
    expect(rows.map(row => row.textContent)).toEqual(["No GPUCurrent5", "RTX 40909", "H1004"]);
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

    expect(screen.getByText("Add a container image and hardware to every service on the left to deploy.")).toBeInTheDocument();
    expect(onChooseProvider).toHaveBeenCalled();
  });

  it("holds the choice while a request is already being submitted", () => {
    setup({ isReady: true, isSubmitting: true });

    expect(screen.getByRole("button", { name: "Choose a provider" })).toBeDisabled();
  });

  function setup(input: {
    eligibleCount?: number;
    networkCount?: number | null;
    placementCount?: number;
    region?: string;
    isLoading?: boolean;
    isRefreshing?: boolean;
    isInvalid?: boolean;
    isError?: boolean;
    isReady?: boolean;
    isSubmitting?: boolean;
  }) {
    const onChooseProvider = vi.fn();
    const useScreenedProviders = vi.fn(() => ({
      providers: Array.from({ length: input.eligibleCount ?? 3 }, () => mock<ScreenedProvider>()),
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false,
      isInvalid: input.isInvalid ?? false,
      isRefreshing: input.isRefreshing ?? false
    }));
    const useGpuAvailability = vi.fn(() => ({
      requestedLabel: "No GPU",
      topModels: [
        { key: "nvidia/rtx4090", label: "RTX 4090", providerCount: 9 },
        { key: "nvidia/h100", label: "H100", providerCount: 4 }
      ]
    }));
    const dependencies: typeof DEPENDENCIES = {
      useScreenedProviders,
      useNetworkProviderCount: () => ({ count: input.networkCount === undefined ? 20 : input.networkCount, isLoading: false }),
      useGpuAvailability,
      CustomTooltip: ComponentMock as never
    };

    render(
      <AvailabilityPane
        sdl="the-sdl"
        placement={mock<PlacementType>({ id: "p1", name: "gpu-pool", region: input.region ?? "" })}
        placementCount={input.placementCount ?? 1}
        isReady={input.isReady ?? true}
        isSubmitting={input.isSubmitting ?? false}
        onChooseProvider={onChooseProvider}
        dependencies={dependencies}
      />
    );

    return { onChooseProvider, useScreenedProviders, useGpuAvailability };
  }
});
