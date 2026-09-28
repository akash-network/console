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
import type { DeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { ConfigureWorkspaceHeader } from "./ConfigureWorkspaceHeader/ConfigureWorkspaceHeader";
import { ConfigureWorkspace, DEPENDENCIES } from "./ConfigureWorkspace";

import { act, render, screen } from "@testing-library/react";
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
    ["offers close and edit once the bids expired", { phase: "quoting", expired: true }, "close-and-edit"]
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

    expect((headerProps().backButton as ReactElement).type).toBe(dependencies.ConfigureDeploymentBackButton);
  });

  it("edits the deployment around the active placement", () => {
    const { editorProps } = setup({});

    expect(editorProps()).toMatchObject({ selectedServiceId: "web", activePlacementId: "p2", deploymentName: "shown-name" });
  });

  it.each<[DeploymentFlow["phase"], ComponentProps<typeof ConfigureEditor>["locked"]]>([
    ["configuring", undefined],
    ["error", undefined],
    ["creating", "all"],
    ["quoting", "onchain"],
    ["deploying", "all"]
  ])("locks the editor as the %s phase requires", (phase, locked) => {
    const { editorProps } = setup({ phase });

    expect(editorProps().locked).toBe(locked);
  });

  it("shows the network availability of the active placement while configuring", () => {
    const { availabilityProps, dependencies } = setup({});

    expect(availabilityProps()).toMatchObject({ sdl: "live-sdl", placementCount: 2, isReady: true, isSubmitting: false });
    expect(availabilityProps().placement).toMatchObject({ id: "p2", name: "gpu-pool" });
    expect(dependencies.MarketplacePane).not.toHaveBeenCalled();
  });

  it("holds the choice of a provider until every placement is fully configured", () => {
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

  it("reveals the first invalid service when the request is rejected", () => {
    const { useRequestQuotes, onSelectService } = setup({});
    const { onInvalid } = useRequestQuotes.mock.calls.at(-1)![0];

    act(() => onInvalid?.({ services: { 1: { image: { type: "manual", message: "Image is required" } } } } as FieldErrors<SdlBuilderFormValuesType>));

    expect(onSelectService).toHaveBeenCalledWith("api");
  });

  it("moves to the marketplace of the active placement once bids are requested", () => {
    const { dependencies, onSelectProvider } = setup({ phase: "quoting", selections: { p2: "bid-2" } });

    expect(dependencies.AvailabilityPane).not.toHaveBeenCalled();
    expect(dependencies.MarketplacePane).toHaveBeenCalledWith(
      expect.objectContaining({ placementName: "gpu-pool", region: "us-west", selectedPlacementId: "p2", selectedBidId: "bid-2", onSelectProvider }),
      expect.anything()
    );
  });

  it.each([
    ["configuring", true],
    ["quoting", false]
  ] as const)("offers the import and the reset only while the deployment is editable (%s)", (phase, isEditable) => {
    const { dependencies, editorProps, onImport, onReset } = setup({ phase });
    render(editorProps().toolbar as ReactElement);

    expect(dependencies.SdlImportExport).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "toolbar", sdl: "live-sdl", deploymentName: "shown-name", canImport: isEditable, onImport }),
      expect.anything()
    );
    expect(dependencies.ResetConfigurationButton).toHaveBeenCalledWith(expect.objectContaining({ disabled: !isEditable, onReset }), expect.anything());
  });

  it("shows the sdl preview only while its feature is on", () => {
    const { dependencies } = setup({ sdlPreviewEnabled: true });

    expect(dependencies.SdlPreviewPane).toHaveBeenCalledWith(expect.objectContaining({ sdl: "preview-sdl" }), expect.anything());
  });

  it("leaves the sdl preview out while its feature is off", () => {
    const { dependencies } = setup({ sdlPreviewEnabled: false });

    expect(dependencies.SdlPreviewPane).not.toHaveBeenCalled();
    expect(screen.queryByText("preview")).not.toBeInTheDocument();
  });

  function setup(input: {
    phase?: DeploymentFlow["phase"];
    selections?: Record<string, string>;
    allPlacementsHaveBids?: boolean;
    cost?: DeploymentCost | null;
    expired?: boolean;
    incompletePlacementId?: string;
    sdlPreviewEnabled?: boolean;
  }) {
    const first = { ...defaultPlacement({ name: "placement-1" }), id: "p1" };
    const second = { ...defaultPlacement({ name: "gpu-pool" }), id: "p2", region: "us-west" };
    const values: SdlBuilderFormValuesType = {
      placements: [first, second],
      services: [
        { ...defaultService("p1", { title: "web" }), id: "web" },
        { ...defaultService("p2", { title: "api" }), id: "api" }
      ],
      endpoints: []
    };
    const flow = mock<DeploymentFlow>({
      phase: input.phase ?? "configuring",
      dseq: null,
      pendingClose: null,
      deployError: undefined,
      actions: mock<DeploymentFlowActions>()
    });
    flow.selections = input.selections ?? {};
    const analyticsService = mock<AnalyticsService>();
    const requestQuotes = vi.fn(() => Promise.resolve());
    const retryDeploy = vi.fn();
    const useRequestQuotes = vi.fn<typeof DEPENDENCIES.useRequestQuotes>(() => requestQuotes);
    const onSelectService = vi.fn();
    const onSelectProvider = vi.fn();
    const onDeploy = vi.fn();
    const onImport = vi.fn();
    const onReset = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useSdlPreviewPanel: () => ({ isEnabled: input.sdlPreviewEnabled ?? false, isOpen: false, open: vi.fn(), close: vi.fn() }),
      useQuoteExpiry: () => (input.expired ? { secondsLeft: 0, isExpired: true } : null),
      useDeploymentCost: () => input.cost ?? null,
      useRequestQuotes,
      useRetryDeploy: () => retryDeploy,
      useConfigurationStatus: () => ({
        isServiceConfigured: () => true,
        placementStatus: placementId => (placementId === input.incompletePlacementId ? "incomplete" : "complete")
      }),
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    });
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values });
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <ConfigureWorkspace
          flow={flow}
          sdl="live-sdl"
          previewSdl="preview-sdl"
          selectedServiceId="web"
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
          dependencies={dependencies}
        />
      </Wrapper>
    );

    return {
      dependencies,
      flow,
      analyticsService,
      requestQuotes,
      retryDeploy,
      useRequestQuotes,
      onSelectService,
      onSelectProvider,
      onDeploy,
      onImport,
      onReset,
      headerProps: () => dependencies.ConfigureWorkspaceHeader.mock.calls.at(-1)?.[0] as ComponentProps<typeof ConfigureWorkspaceHeader>,
      editorProps: () => dependencies.ConfigureEditor.mock.calls.at(-1)?.[0] as ComponentProps<typeof ConfigureEditor>,
      availabilityProps: () => dependencies.AvailabilityPane.mock.calls.at(-1)?.[0] as ComponentProps<typeof AvailabilityPane>
    };
  }
});
