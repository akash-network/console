import { describe, expect, it, vi } from "vitest";

import type { DeployPhase, DeployProgressState } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import type { DEPENDENCIES } from "./PhasedDeployProgressScene";
import { PhasedDeployProgressScene } from "./PhasedDeployProgressScene";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

const PHASES: [DeployPhase, DeployPhase, DeployPhase] = [
  { id: "creating", label: "Deployment created", status: "completed" },
  { id: "matching", label: "Providers matched", status: "completed" },
  { id: "preparing", label: "Preparing deployment", status: "active" }
];

describe(PhasedDeployProgressScene.name, () => {
  it("forwards the progress state and callbacks to the progress panel", () => {
    const PhasedDeploymentProgress = vi.fn(ComponentMock);
    const onStartOver = vi.fn();
    const onContactSupport = vi.fn();
    const onChooseProvider = vi.fn();
    setup({
      templateName: "my-app",
      state: { kind: "preparing" },
      progressPercent: 67,
      onStartOver,
      onContactSupport,
      onChooseProvider,
      dependencies: { PhasedDeploymentProgress }
    });

    expect(PhasedDeploymentProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        templateName: "my-app",
        state: { kind: "preparing" },
        progressPercent: 67,
        phases: PHASES,
        onStartOver,
        onContactSupport,
        onChooseProvider
      }),
      expect.anything()
    );
  });

  it("focuses the globe on the provided provider address", () => {
    const ProviderGlobe = vi.fn(ComponentMock);
    setup({ focusedProviderAddress: "akash1provider", dependencies: { ProviderGlobe } });

    expect(ProviderGlobe).toHaveBeenCalledWith(expect.objectContaining({ focusedProviderAddress: "akash1provider" }), expect.anything());
  });

  it("applies the extra wrapper classes passed in for overlay positioning", () => {
    const { container } = setup({ className: "absolute inset-0 z-20" });

    expect(container.firstChild).toHaveClass("absolute", "inset-0", "z-20", "flex", "flex-col");
  });

  function setup(
    input: {
      templateName?: string;
      state?: DeployProgressState;
      progressPercent?: number;
      focusedProviderAddress?: string | null;
      className?: string;
      onStartOver?: () => void;
      onContactSupport?: () => void;
      onChooseProvider?: () => void;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    return render(
      <PhasedDeployProgressScene
        templateName={input.templateName ?? "your deployment"}
        state={input.state ?? { kind: "preparing" }}
        progressPercent={input.progressPercent ?? 0}
        phases={PHASES}
        focusedProviderAddress={input.focusedProviderAddress}
        className={input.className}
        onStartOver={input.onStartOver}
        onContactSupport={input.onContactSupport}
        onChooseProvider={input.onChooseProvider}
        dependencies={{ PhasedDeploymentProgress: vi.fn(ComponentMock), ProviderGlobe: vi.fn(ComponentMock), ...input.dependencies }}
      />
    );
  }
});
