import { afterEach, describe, expect, it, vi } from "vitest";

import type { DEPENDENCIES } from "./PhasedDeploymentContainer";
import { PhasedDeploymentContainer } from "./PhasedDeploymentContainer";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type FlowResult = ReturnType<typeof DEPENDENCIES.usePhasedDeploymentFlow>;

describe(PhasedDeploymentContainer.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the flow state and template name through to the progress scene", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({
      templateName: "my-app",
      flow: { state: { kind: "matching" }, progressPercent: 42 },
      dependencies: { PhasedDeployProgressScene }
    });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(
      expect.objectContaining({ state: { kind: "matching" }, templateName: "my-app", progressPercent: 42 }),
      expect.anything()
    );
  });

  it("focuses the scene on the matched provider address", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ flow: { matchedProviderAddress: "akash1provider" }, dependencies: { PhasedDeployProgressScene } });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ focusedProviderAddress: "akash1provider" }), expect.anything());
  });

  it("resumes the flow with the initial dseq and forwards the intent params", () => {
    const usePhasedDeploymentFlow = vi.fn(() => buildFlow());
    setup({ initialDseq: "999", templateId: "hello-world", draftId: "d1", usePhasedDeploymentFlow });

    expect(usePhasedDeploymentFlow).toHaveBeenCalledWith(expect.objectContaining({ initialDseq: "999", templateId: "hello-world", draftId: "d1" }));
  });

  it("invokes startOver and onCancel when the scene requests a start over", () => {
    const startOver = vi.fn();
    const onCancel = vi.fn();
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ flow: { startOver }, onCancel, dependencies: { PhasedDeployProgressScene } });

    const onStartOver = PhasedDeployProgressScene.mock.calls[0][0].onStartOver as () => void;
    onStartOver();

    expect(startOver).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("opens the Akash Discord when the scene requests support", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ dependencies: { PhasedDeployProgressScene } });

    const onContactSupport = PhasedDeployProgressScene.mock.calls[0][0].onContactSupport as () => void;
    onContactSupport();

    expect(open).toHaveBeenCalledWith("https://akash.network/discord", "_blank", "noopener,noreferrer");
  });

  function buildFlow(overrides: Partial<FlowResult> = {}): FlowResult {
    return {
      state: { kind: "creating" },
      progressPercent: 0,
      phases: [
        { id: "creating", label: "Creating", status: "active" },
        { id: "matching", label: "Matching", status: "pending" },
        { id: "preparing", label: "Preparing", status: "pending" }
      ],
      matchedProviderAddress: null,
      retry: vi.fn(),
      startOver: vi.fn(),
      ...overrides
    };
  }

  function setup(
    input: {
      templateName?: string;
      sdl?: string;
      isWalletReady?: boolean;
      initialDseq?: string;
      templateId?: string;
      draftId?: string;
      onCancel?: () => void;
      flow?: Partial<FlowResult>;
      usePhasedDeploymentFlow?: typeof DEPENDENCIES.usePhasedDeploymentFlow;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const usePhasedDeploymentFlow: typeof DEPENDENCIES.usePhasedDeploymentFlow = input.usePhasedDeploymentFlow ?? (() => buildFlow(input.flow));

    return render(
      <PhasedDeploymentContainer
        templateName={input.templateName ?? "test-template"}
        sdl={input.sdl ?? "sdl-content"}
        isWalletReady={input.isWalletReady ?? true}
        initialDseq={input.initialDseq}
        templateId={input.templateId}
        draftId={input.draftId}
        onCancel={input.onCancel}
        dependencies={{ usePhasedDeploymentFlow, PhasedDeployProgressScene: vi.fn(ComponentMock), ...input.dependencies }}
      />
    );
  }
});
