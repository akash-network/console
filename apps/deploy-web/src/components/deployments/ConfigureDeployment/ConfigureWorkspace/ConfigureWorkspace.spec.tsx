import type { ComponentProps, ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { ConfigureEditor } from "../ConfigureEditor/ConfigureEditor";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import { ConfigureWorkspace, DEPENDENCIES } from "./ConfigureWorkspace";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(ConfigureWorkspace.name, () => {
  it("asks for quotes under the name the user typed", () => {
    const { dependencies, flow } = setup({});

    expect(dependencies.ConfigureDeploymentHeader).toHaveBeenCalledWith(
      expect.objectContaining({ flow, sdl: "live-sdl", deploymentName: "typed-name", allPlacementsHaveBids: false }),
      expect.anything()
    );
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

  it("scopes the marketplace to the active placement and its chosen bid", () => {
    const { dependencies, onSelectProvider } = setup({ selections: { p2: "bid-2" } });

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

  function setup(input: { phase?: DeploymentFlow["phase"]; selections?: Record<string, string>; sdlPreviewEnabled?: boolean }) {
    const flow = mock<DeploymentFlow>({
      phase: input.phase ?? "configuring",
      dseq: null,
      pendingClose: null,
      actions: mock<DeploymentFlowActions>()
    });
    flow.selections = input.selections ?? {};
    const onSelectProvider = vi.fn();
    const onImport = vi.fn();
    const onReset = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useSdlPreviewPanel: () => ({ isEnabled: input.sdlPreviewEnabled ?? false, isOpen: false, open: vi.fn(), close: vi.fn() })
    });

    render(
      <ConfigureWorkspace
        flow={flow}
        sdl="live-sdl"
        previewSdl="preview-sdl"
        selectedServiceId="web"
        selectedPlacement={mock<PlacementType>({ id: "p2", name: "gpu-pool", region: "us-west" })}
        onSelectService={vi.fn()}
        onSelectProvider={onSelectProvider}
        deploymentName="shown-name"
        typedDeploymentName="typed-name"
        onDeploymentNameChange={vi.fn()}
        onDeploy={vi.fn()}
        allPlacementsHaveBids={false}
        onImport={onImport}
        onReset={onReset}
        dependencies={dependencies}
      />
    );

    return {
      dependencies,
      flow,
      onSelectProvider,
      onImport,
      onReset,
      editorProps: () => dependencies.ConfigureEditor.mock.calls.at(-1)?.[0] as ComponentProps<typeof ConfigureEditor>
    };
  }
});
