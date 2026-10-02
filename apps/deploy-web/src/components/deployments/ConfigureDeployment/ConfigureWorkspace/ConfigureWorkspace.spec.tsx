import type { ComponentProps, PropsWithChildren, ReactElement } from "react";
import type { FieldErrors } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { PlacementType, SdlBuilderFormValuesType } from "@src/types";
import { defaultPlacement, defaultService } from "@src/utils/sdl/data";
import type { AvailabilityPane } from "../AvailabilityPane/AvailabilityPane";
import type { ConfigureEditor } from "../ConfigureEditor/ConfigureEditor";
import type { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import type { DeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { ConfigureWorkspaceHeader } from "./ConfigureWorkspaceHeader/ConfigureWorkspaceHeader";
import type { LeaveConfigureButton } from "./LeaveConfigureButton/LeaveConfigureButton";
import type { LockedDeploymentRail } from "./LockedDeploymentRail/LockedDeploymentRail";
import type { NoBidsNotice } from "./NoBidsNotice/NoBidsNotice";
import type { PlacementProviderChips } from "./PlacementProviderChips/PlacementProviderChips";
import { ConfigureWorkspace, DEPENDENCIES } from "./ConfigureWorkspace";

import { act, render, screen, waitFor } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(ConfigureWorkspace.name, () => {
  it.each<[string, Parameters<typeof setup>[0], ComponentProps<typeof ConfigureWorkspaceHeader>["ctaState"]]>([
    ["asks for nothing while configuring", {}, "request-quotes"],
    ["waits for bids while quoting", { phase: "quoting" }, "requesting"],
    [
      "asks for providers once every placement has bids",
      { phase: "quoting", allPlacementsHaveBids: true, cost: { minPerBlock: 1, maxPerBlock: 1, denom: "uact" } },
      "select-providers"
    ],
    [
      "offers the deploy once every placement has a provider",
      { phase: "quoting", allPlacementsHaveBids: true, selections: { p1: "bid-1", p2: "bid-2" }, cost: { minPerBlock: 1, maxPerBlock: 1, denom: "uact" } },
      "deploy"
    ],
    ["offers close and edit once the bids expired", { phase: "quoting", expired: true }, "close-and-edit"],
    ["offers close and edit once the wait for a first bid ran out", { phase: "quoting", noBidsReceived: true }, "close-and-edit"]
  ])("%s", (_, input, ctaState) => {
    const { headerProps } = setup(input);

    expect(headerProps().ctaState).toBe(ctaState);
  });

  it("hands the header the deploy, the retry and close and edit", () => {
    const { headerProps, onDeploy, retryDeploy, flow } = setup({});

    expect(headerProps()).toMatchObject({ onDeploy, onRetry: retryDeploy, onCloseAndEdit: flow.actions.cancelAndEdit });
  });

  it("puts the back button beside the page title", () => {
    const { headerProps, dependencies } = setup({});

    expect((headerProps().backButton as ReactElement).type).toBe(dependencies.LeaveConfigureButton);
  });

  describe("while configuring", () => {
    it("edits the deployment around the active placement", () => {
      const { editorProps } = setup({});

      expect(editorProps()).toMatchObject({ selectedServiceId: "web", activePlacementId: "p2", deploymentName: "shown-name", pendingClose: null });
    });

    it("shows the network availability of the active placement", () => {
      const { availabilityProps, dependencies } = setup({});

      expect(availabilityProps()).toMatchObject({ sdl: "live-sdl", placementCount: 2, isReady: true, isSubmitting: false });
      expect(availabilityProps().placement).toMatchObject({ id: "p2", name: "gpu-pool" });
      expect(dependencies.MarketplacePane).not.toHaveBeenCalled();
      expect(dependencies.LockedDeploymentRail).not.toHaveBeenCalled();
    });

    it("tells the availability panel while a placement still needs configuring", () => {
      const { availabilityProps } = setup({ incompletePlacementId: "p1" });

      expect(availabilityProps().isReady).toBe(false);
    });

    it("tracks the choice of a provider and requests bids under the typed name", () => {
      const { availabilityProps, requestQuotes, useRequestQuotes, analyticsService } = setup({});

      act(() => availabilityProps().onChooseProvider());

      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_clicked", { category: "deployments" });
      expect(requestQuotes).toHaveBeenCalled();
      expect(useRequestQuotes).toHaveBeenCalledWith(expect.objectContaining({ deploymentName: "typed-name" }));
    });

    it("tracks a compute request and asks for it with the selected service's configuration", () => {
      const { availabilityProps, analyticsService, dependencies } = setup({ selectedServiceId: "api" });
      expect(dependencies.HardwareRequestDialog).not.toHaveBeenCalled();

      act(() => availabilityProps().onRequestCompute());

      expect(analyticsService.track).toHaveBeenCalledWith("configure_request_compute_clicked", { category: "deployments", source: "footer" });
      expect(screen.getByText("Hardware request dialog")).toBeInTheDocument();
      expect(dependencies.HardwareRequestDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialGpuModel: "",
          initialCategory: "gpu_model",
          configuration: expect.objectContaining({ summary: "0.1 vCPU · 512 MiB memory · 1 GiB storage · us-west, eu-west" })
        }),
        expect.anything()
      );
    });

    it("closes the hardware request dialog when it asks to", () => {
      const { availabilityProps, dependencies } = setup({});
      act(() => availabilityProps().onRequestCompute());

      act(() => dependencies.HardwareRequestDialog.mock.lastCall![0].onClose());

      expect(screen.queryByText("Hardware request dialog")).not.toBeInTheDocument();
    });

    it("reveals the first invalid service when the request is rejected", () => {
      const { useRequestQuotes, onSelectService } = setup({});
      const { onInvalid } = useRequestQuotes.mock.calls.at(-1)![0];

      act(() => onInvalid?.({ services: { 1: { image: { type: "manual", message: "Image is required" } } } } as FieldErrors<SdlBuilderFormValuesType>));

      expect(onSelectService).toHaveBeenCalledWith("api");
    });

    it("offers the import and the reset in the editor toolbar", () => {
      const { dependencies, editorProps, onImport, onReset } = setup({});
      render(editorProps().toolbar as ReactElement);

      expect(dependencies.SdlImportExport).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "toolbar", sdl: "live-sdl", deploymentName: "shown-name", canImport: true, onImport }),
        expect.anything()
      );
      expect(dependencies.ResetConfigurationButton).toHaveBeenCalledWith(expect.objectContaining({ disabled: false, onReset }), expect.anything());
    });

    it("screens every placement so the picker has each placement's providers once screening pauses", () => {
      const { useScreenedProviders } = setup({});

      expect(useScreenedProviders).toHaveBeenCalledWith({ sdl: "live-sdl", placementName: "placement-1", regions: [], enabled: true });
      expect(useScreenedProviders).toHaveBeenCalledWith({ sdl: "live-sdl", placementName: "gpu-pool", regions: ["us-west", "eu-west"], enabled: true });
    });
  });

  describe("once bids are requested", () => {
    it("locks the deployment into a rail under its name", () => {
      const { railProps, dependencies } = setup({ phase: "quoting" });

      expect(railProps().deploymentName).toBe("shown-name");
      expect(dependencies.ConfigureEditor).not.toHaveBeenCalled();
    });

    it("unlocks the configuration from the rail and tracks it", () => {
      const { railProps, flow, analyticsService } = setup({ phase: "quoting" });

      act(() => railProps().onEdit());

      expect(analyticsService.track).toHaveBeenCalledWith("configure_edit_clicked", { category: "deployments" });
      expect(flow.actions.cancelAndEdit).toHaveBeenCalled();
    });

    it("picks providers in the expanded marketplace of the active placement", () => {
      const { marketplaceProps, onSelectProvider, dependencies } = setup({ phase: "quoting", selections: { p2: "bid-2" } });

      expect(marketplaceProps()).toMatchObject({
        variant: "expanded",
        placementName: "gpu-pool",
        regions: ["us-west", "eu-west"],
        selectedPlacementId: "p2",
        selectedBidId: "bid-2",
        onSelectProvider
      });
      expect(dependencies.AvailabilityPane).not.toHaveBeenCalled();
    });

    it("shows which placement a provider is picked for and moves to another one from its chip", () => {
      const { chipsProps, onSelectService } = setup({ phase: "quoting", selections: { p1: "bid-1" } });

      expect(chipsProps()).toMatchObject({ dseq: "42", selections: { p1: "bid-1" }, activePlacementId: "p2" });
      act(() => chipsProps().onSelectPlacement("p1"));

      expect(onSelectService).toHaveBeenCalledWith("web");
    });

    it("explains in the marketplace that no provider bid once the wait for a first bid ran out", () => {
      const { marketplaceProps, dependencies } = setup({ phase: "quoting", noBidsReceived: true });

      expect((marketplaceProps().notice as ReactElement).type).toBe(dependencies.NoBidsNotice);
    });

    it("keeps the waiting card while the wait for a first bid is still running", () => {
      const { marketplaceProps } = setup({ phase: "quoting" });

      expect(marketplaceProps().notice).toBeUndefined();
    });

    it("asks for more capacity from the no-bid notice and tracks that the request came from there", () => {
      const { marketplaceProps, analyticsService, dependencies } = setup({ phase: "quoting", noBidsReceived: true, selectedServiceId: "api" });

      act(() => ((marketplaceProps().notice as ReactElement).props as ComponentProps<typeof NoBidsNotice>).onRequestCompute());

      expect(analyticsService.track).toHaveBeenCalledWith("configure_request_compute_clicked", { category: "deployments", source: "no_bids_notice" });
      expect(dependencies.HardwareRequestDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialCategory: "capacity",
          configuration: expect.objectContaining({ summary: "0.1 vCPU · 512 MiB memory · 1 GiB storage · us-west, eu-west" })
        }),
        expect.anything()
      );
    });

    it("keeps screening paused while the bids are live", () => {
      const { useScreenedProviders } = setup({ phase: "quoting" });

      expect(useScreenedProviders).toHaveBeenCalledWith(expect.objectContaining({ placementName: "gpu-pool", enabled: false }));
    });
  });

  it("leaves without asking while the deployment is only being configured", () => {
    const { leaveProps } = setup({});

    expect(leaveProps()).toMatchObject({ needsConfirmation: false, canEditInstead: false });
  });

  it("asks before leaving a pending deployment and hands the question what would be lost", () => {
    const { leaveProps, onDiscard } = setup({ phase: "quoting", bidCount: 1 });

    expect(leaveProps()).toMatchObject({
      needsConfirmation: true,
      deploymentName: "shown-name",
      serviceCount: 2,
      placementCount: 2,
      hasBids: true,
      canEditInstead: true,
      onDiscard
    });
  });

  it("asks before leaving while a previous deployment is still closing", () => {
    const { leaveProps } = setup({ pendingClose: { dseq: "41", failed: true } });

    expect(leaveProps()).toMatchObject({ needsConfirmation: true, hasBids: false });
  });

  it("follows the bid window in a toast", () => {
    const { dependencies } = setup({ phase: "quoting", expired: true });

    expect(dependencies.BidWindowToast).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "quoting", dseq: "42", sdl: "live-sdl", expiry: { secondsLeft: 0, isExpired: true }, noBidsReceived: false }),
      expect.anything()
    );
  });

  it("tells the bid window toast once the wait for a first bid ran out", () => {
    const { dependencies } = setup({ phase: "quoting", noBidsReceived: true });

    expect(dependencies.BidWindowToast).toHaveBeenLastCalledWith(expect.objectContaining({ noBidsReceived: true }), expect.anything());
  });

  it("slides from the editor to the picker once bids are requested, and back after Edit", async () => {
    const { dependencies, rerender } = setup({});

    rerender({ phase: "quoting" });

    expect(dependencies.LockedDeploymentRail).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("editor")).not.toBeInTheDocument());

    rerender({ phase: "configuring" });

    await waitFor(() => expect(screen.queryByText("rail")).not.toBeInTheDocument());
    expect(screen.getByText("editor")).toBeInTheDocument();
  });

  it("moves the focus to the picker when it sat on the panel that left, and says so", () => {
    const { rerender } = setup({});
    screen.getByRole("button", { name: "Choose a provider" }).focus();

    rerender({ phase: "quoting" });

    expect(screen.getByRole("heading", { name: "Compute Marketplace" })).toHaveFocus();
    expect(screen.getByText("Pick a provider for each placement.")).toBeInTheDocument();
  });

  it("leaves the focus alone when it sat outside the panels", () => {
    const { rerender } = setup({});
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    outside.focus();

    rerender({ phase: "quoting" });

    expect(outside).toHaveFocus();
    outside.remove();
  });

  it("shows the sdl preview only while its feature is on", () => {
    const { dependencies } = setup({ sdlPreviewEnabled: true });

    expect(dependencies.SdlPreviewPane).toHaveBeenCalledWith(expect.objectContaining({ sdl: "preview-sdl" }), expect.anything());
  });

  it("leaves the sdl preview out while its feature is off", () => {
    const { dependencies } = setup({ sdlPreviewEnabled: false });

    expect(dependencies.SdlPreviewPane).not.toHaveBeenCalled();
  });

  function setup(input: {
    phase?: DeploymentFlow["phase"];
    selections?: Record<string, string>;
    allPlacementsHaveBids?: boolean;
    cost?: DeploymentCost | null;
    expired?: boolean;
    incompletePlacementId?: string;
    sdlPreviewEnabled?: boolean;
    bidCount?: number;
    pendingClose?: DeploymentFlow["pendingClose"];
    selectedServiceId?: string;
    noBidsReceived?: boolean;
  }) {
    const first = { ...defaultPlacement({ name: "placement-1" }), id: "p1", regions: [] };
    const second = { ...defaultPlacement({ name: "gpu-pool" }), id: "p2", regions: ["us-west", "eu-west"] };
    const values: SdlBuilderFormValuesType = {
      placements: [first, second],
      services: [
        { ...defaultService("p1", { title: "web" }), id: "web" },
        { ...defaultService("p2", { title: "api" }), id: "api" }
      ],
      endpoints: []
    };
    const analyticsService = mock<AnalyticsService>();
    const requestQuotes = vi.fn(() => Promise.resolve());
    const retryDeploy = vi.fn();
    const cancelAndEdit = vi.fn();
    const useRequestQuotes = vi.fn<typeof DEPENDENCIES.useRequestQuotes>(() => requestQuotes);
    const useScreenedProviders = vi.fn<typeof DEPENDENCIES.useScreenedProviders>(() => ({
      providers: [],
      isLoading: false,
      isError: false,
      isInvalid: false,
      isRefreshing: false
    }));
    const onSelectService = vi.fn();
    const onSelectProvider = vi.fn();
    const onDeploy = vi.fn();
    const onImport = vi.fn();
    const onReset = vi.fn();
    const onDiscard = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      ConfigureEditor: vi.fn(() => <span>editor</span>),
      AvailabilityPane: vi.fn(() => <button type="button">Choose a provider</button>),
      LockedDeploymentRail: vi.fn(() => <span>rail</span>),
      MarketplacePane: vi.fn(() => (
        <h2 tabIndex={-1} className="outline-none">
          Compute Marketplace
        </h2>
      )),
      HardwareRequestDialog: vi.fn(() => <div>Hardware request dialog</div>),
      useSdlPreviewPanel: () => ({ isEnabled: input.sdlPreviewEnabled ?? false, isOpen: false, open: vi.fn(), close: vi.fn() }),
      useGpuModels: () => mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>({ data: [] }),
      useQuoteExpiry: () => (input.expired ? { secondsLeft: 0, isExpired: true } : null),
      useDeploymentCost: () => input.cost ?? null,
      useRequestQuotes,
      useRetryDeploy: () => retryDeploy,
      useConfigurationStatus: () => ({
        placementStatus: placementId => (placementId === input.incompletePlacementId ? "incomplete" : "complete")
      }),
      useScreenedProviders,
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    });
    const flowIn = (phase: DeploymentFlow["phase"]) => {
      const flow = mock<DeploymentFlow>({
        phase,
        dseq: "42",
        pendingClose: input.pendingClose ?? null,
        deployError: undefined,
        noBidsReceived: input.noBidsReceived ?? false,
        bids: Array.from({ length: input.bidCount ?? 0 }, () => mock<DeploymentFlow["bids"][number]>()),
        actions: mock<DeploymentFlowActions>({ cancelAndEdit })
      });
      flow.selections = input.selections ?? {};
      return flow;
    };
    const flow = flowIn(input.phase ?? "configuring");
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const workspace = (currentFlow: DeploymentFlow) => (
      <ConfigureWorkspace
        flow={currentFlow}
        sdl="live-sdl"
        previewSdl="preview-sdl"
        selectedServiceId={input.selectedServiceId ?? "web"}
        selectedPlacement={second as PlacementType}
        onSelectService={onSelectService}
        onSelectProvider={onSelectProvider}
        deploymentName="shown-name"
        typedDeploymentName="typed-name"
        onDeploymentNameChange={vi.fn()}
        onDeploy={onDeploy}
        allPlacementsHaveBids={input.allPlacementsHaveBids ?? false}
        onImport={onImport}
        onReset={onReset}
        onDiscard={onDiscard}
        dependencies={dependencies}
      />
    );
    const rendered = render(workspace(flow), { wrapper: Wrapper });

    return {
      dependencies,
      flow,
      analyticsService,
      requestQuotes,
      retryDeploy,
      useRequestQuotes,
      useScreenedProviders,
      onSelectService,
      onSelectProvider,
      onDeploy,
      onImport,
      onReset,
      onDiscard,
      leaveProps: () => {
        const header = dependencies.ConfigureWorkspaceHeader.mock.calls.at(-1)?.[0] as ComponentProps<typeof ConfigureWorkspaceHeader>;
        return (header.backButton as ReactElement).props as ComponentProps<typeof LeaveConfigureButton>;
      },
      rerender: (next: { phase: DeploymentFlow["phase"] }) => rendered.rerender(workspace(flowIn(next.phase))),
      headerProps: () => dependencies.ConfigureWorkspaceHeader.mock.calls.at(-1)?.[0] as ComponentProps<typeof ConfigureWorkspaceHeader>,
      editorProps: () => dependencies.ConfigureEditor.mock.calls.at(-1)?.[0] as ComponentProps<typeof ConfigureEditor>,
      availabilityProps: () => dependencies.AvailabilityPane.mock.calls.at(-1)?.[0] as ComponentProps<typeof AvailabilityPane>,
      railProps: () => dependencies.LockedDeploymentRail.mock.calls.at(-1)?.[0] as ComponentProps<typeof LockedDeploymentRail>,
      marketplaceProps: () => dependencies.MarketplacePane.mock.calls.at(-1)?.[0] as ComponentProps<typeof MarketplacePane>,
      chipsProps: () => {
        const marketplace = dependencies.MarketplacePane.mock.calls.at(-1)?.[0] as ComponentProps<typeof MarketplacePane>;
        return (marketplace.chips as ReactElement).props as ComponentProps<typeof PlacementProviderChips>;
      }
    };
  }
});
