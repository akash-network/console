import { describe, expect, it, vi } from "vitest";

import type { ManualDeployActivePhase } from "@src/hooks/usePhasedDeploymentFlow/deployPhases";
import type { DEPENDENCIES } from "./DeployProgressOverlay";
import { DeployProgressOverlay } from "./DeployProgressOverlay";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type ProgressResult = ReturnType<typeof DEPENDENCIES.usePhasedDeployProgress>;

const PROGRESS: ProgressResult = {
  state: { kind: "preparing" },
  progressPercent: 67,
  phases: [
    { id: "creating", label: "Deployment created", status: "completed" },
    { id: "matching", label: "Providers matched", status: "completed" },
    { id: "preparing", label: "Preparing deployment", status: "active" }
  ]
};

describe(DeployProgressOverlay.name, () => {
  it("derives the progress from the active phase and passes it to the scene", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    const usePhasedDeployProgress = vi.fn(() => PROGRESS);
    setup({ activePhase: "success", dependencies: { PhasedDeployProgressScene, usePhasedDeployProgress } });

    expect(usePhasedDeployProgress).toHaveBeenCalledWith("success");
    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(
      expect.objectContaining({ state: PROGRESS.state, progressPercent: 67, phases: PROGRESS.phases }),
      expect.anything()
    );
  });

  it("defaults to the preparing phase", () => {
    const usePhasedDeployProgress = vi.fn(() => PROGRESS);
    setup({ dependencies: { usePhasedDeployProgress } });

    expect(usePhasedDeployProgress).toHaveBeenCalledWith("preparing");
  });

  it("focuses the globe on the chosen provider", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ providerAddress: "akash1provider", dependencies: { PhasedDeployProgressScene } });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ focusedProviderAddress: "akash1provider" }), expect.anything());
  });

  it("titles the scene with the deployment name", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ deploymentName: "my-app", dependencies: { PhasedDeployProgressScene } });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ templateName: "my-app" }), expect.anything());
  });

  it("falls back to a generic title when the deployment name is blank", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ deploymentName: "   ", dependencies: { PhasedDeployProgressScene } });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ templateName: "your deployment" }), expect.anything());
  });

  function setup(input: {
    providerAddress?: string | null;
    activePhase?: ManualDeployActivePhase;
    deploymentName?: string;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    return render(
      <DeployProgressOverlay
        providerAddress={input.providerAddress}
        activePhase={input.activePhase}
        deploymentName={input.deploymentName}
        dependencies={{ PhasedDeployProgressScene: vi.fn(ComponentMock), usePhasedDeployProgress: vi.fn(() => PROGRESS), ...input.dependencies }}
      />
    );
  }
});
