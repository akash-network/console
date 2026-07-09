import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ResumeResolution } from "../ResumeDeploymentGuard/ResumeDeploymentGuard";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./AutoDeployFlow";
import { AutoDeployFlow } from "./AutoDeployFlow";

import { render } from "@testing-library/react";
import { ComponentMock } from "@tests/unit/mocks";

type SceneProps = Parameters<typeof DEPENDENCIES.PhasedDeployProgressScene>[0];
type FlowResult = ReturnType<typeof DEPENDENCIES.useAutoDeploymentFlow>;

const CONTACT_SUPPORT_URL = "https://akash.network/discord";

describe(AutoDeployFlow.name, () => {
  it("drives the autopilot with the shared flow, trial readiness, and the resolved SDL", () => {
    const useAutoDeploymentFlow = vi.fn(() => buildAutopilot());
    const trialError = new Error("trial failed");
    const flow = mock<DeploymentFlow>();
    setup({ sdl: "sdl-content", flow, isWalletReady: true, trialError, useAutoDeploymentFlow });

    expect(useAutoDeploymentFlow).toHaveBeenCalledWith({ sdl: "sdl-content", isWalletReady: true, trialError, resumeLeases: [], flow });
  });

  it("forwards the guard's resolved live leases to the flow so it can re-send the manifest", () => {
    const useAutoDeploymentFlow = vi.fn(() => buildAutopilot());
    const activeLeases = [{ dseq: "555", gseq: 1, oseq: 2, provider: "akash1provider" }];
    setup({ resume: { activeLeases }, useAutoDeploymentFlow });

    expect(useAutoDeploymentFlow).toHaveBeenCalledWith(expect.objectContaining({ resumeLeases: activeLeases }));
  });

  it("passes the flow state and template name through to the progress scene", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({
      templateName: "my-app",
      autopilot: { state: { kind: "matching" }, progressPercent: 42 },
      dependencies: { PhasedDeployProgressScene }
    });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(
      expect.objectContaining({ state: { kind: "matching" }, templateName: "my-app", progressPercent: 42 }),
      expect.anything()
    );
  });

  it("focuses the scene on the matched provider address", () => {
    const PhasedDeployProgressScene = vi.fn(ComponentMock);
    setup({ autopilot: { matchedProviderAddress: "akash1provider" }, dependencies: { PhasedDeployProgressScene } });

    expect(PhasedDeployProgressScene).toHaveBeenCalledWith(expect.objectContaining({ focusedProviderAddress: "akash1provider" }), expect.anything());
  });

  it("asks the flow to try again when the scene requests it", () => {
    const tryAgain = vi.fn();
    const { sceneProps } = setup({ autopilot: { tryAgain } });

    sceneProps().onTryAgain?.();

    expect(tryAgain).toHaveBeenCalledTimes(1);
  });

  it("resets the trial before restarting when the trial has errored, so the retry is not a dead-end", () => {
    const tryAgain = vi.fn();
    const retryTrial = vi.fn();
    const { sceneProps } = setup({ autopilot: { tryAgain }, isWalletReady: false, trialError: new Error("trial failed"), retryTrial });

    sceneProps().onTryAgain?.();

    expect(retryTrial).toHaveBeenCalledTimes(1);
    expect(tryAgain).toHaveBeenCalledTimes(1);
  });

  it("does not reset the trial on retry when there was no trial error", () => {
    const retryTrial = vi.fn();
    const { sceneProps } = setup({ autopilot: { tryAgain: vi.fn() }, isWalletReady: true, retryTrial });

    sceneProps().onTryAgain?.();

    expect(retryTrial).not.toHaveBeenCalled();
  });

  it("stops the autopilot and switches to manual bid selection when the user chooses a provider", () => {
    const stopAutopilot = vi.fn();
    const setBidStrategy = vi.fn();
    const flow = mock<DeploymentFlow>({ actions: mock<DeploymentFlow["actions"]>({ setBidStrategy }) });
    const { sceneProps } = setup({ flow, autopilot: { stopAutopilot } });

    sceneProps().onChooseProvider?.();

    expect(stopAutopilot).toHaveBeenCalledTimes(1);
    expect(setBidStrategy).toHaveBeenCalledWith("select");
  });

  it("opens the configured contact-support URL when the scene requests support", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const { sceneProps } = setup({ contactSupportUrl: "https://support.example" });

    sceneProps().onContactSupport?.();

    expect(open).toHaveBeenCalledWith("https://support.example", "_blank", "noopener,noreferrer");
  });

  function buildAutopilot(overrides: Partial<FlowResult> = {}): FlowResult {
    return {
      state: { kind: "creating" },
      progressPercent: 0,
      phases: [
        { id: "creating", label: "Creating", status: "active" },
        { id: "matching", label: "Matching", status: "pending" },
        { id: "preparing", label: "Preparing", status: "pending" }
      ],
      matchedProviderAddress: null,
      tryAgain: vi.fn(),
      stopAutopilot: vi.fn(),
      ...overrides
    };
  }

  function setup(
    input: {
      templateName?: string;
      sdl?: string;
      resume?: ResumeResolution;
      flow?: DeploymentFlow;
      isWalletReady?: boolean;
      trialError?: unknown;
      retryTrial?: () => void;
      contactSupportUrl?: string;
      autopilot?: Partial<FlowResult>;
      useAutoDeploymentFlow?: typeof DEPENDENCIES.useAutoDeploymentFlow;
      dependencies?: Partial<typeof DEPENDENCIES>;
    } = {}
  ) {
    const PhasedDeployProgressScene = input.dependencies?.PhasedDeployProgressScene ?? vi.fn(ComponentMock);
    const useAutoDeploymentFlow: typeof DEPENDENCIES.useAutoDeploymentFlow = input.useAutoDeploymentFlow ?? (() => buildAutopilot(input.autopilot));
    const useServices: typeof DEPENDENCIES.useServices = () =>
      mock<ReturnType<typeof DEPENDENCIES.useServices>>({
        publicConfig: { NEXT_PUBLIC_CONTACT_SUPPORT_URL: input.contactSupportUrl ?? CONTACT_SUPPORT_URL }
      });

    render(
      <AutoDeployFlow
        templateName={input.templateName ?? "Hello World"}
        sdl={input.sdl ?? "sdl-content"}
        resume={input.resume ?? { activeLeases: [] }}
        flow={input.flow ?? mock<DeploymentFlow>()}
        isWalletReady={input.isWalletReady ?? true}
        trialError={input.trialError}
        retryTrial={input.retryTrial ?? vi.fn()}
        dependencies={{
          Layout: ComponentMock,
          PhasedDeployProgressScene,
          useAutoDeploymentFlow,
          useServices,
          ...input.dependencies
        }}
      />
    );

    return { sceneProps: () => (PhasedDeployProgressScene as ReturnType<typeof vi.fn>).mock.calls[0][0] as SceneProps };
  }
});
