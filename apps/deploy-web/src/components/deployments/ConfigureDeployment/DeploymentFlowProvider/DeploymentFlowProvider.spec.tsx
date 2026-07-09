import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES, DeploymentFlowContext } from "./DeploymentFlowProvider";
import { DeploymentFlowProvider } from "./DeploymentFlowProvider";

import { render, screen } from "@testing-library/react";

describe(DeploymentFlowProvider.name, () => {
  it("passes the given intent into the deployment flow", () => {
    const useDeploymentFlow = vi.fn(() => mock<DeploymentFlow>());
    const intent = intentFor("555");
    setup({ intent, useDeploymentFlow });

    expect(useDeploymentFlow).toHaveBeenCalledWith(expect.objectContaining({ intent }));
  });

  it("exposes the flow and trial handles to its children", () => {
    const flow = mock<DeploymentFlow>();
    const retryTrial = vi.fn();
    const trialError = new Error("trial failed");
    const { getContext } = setup({ flow, trial: { isWalletReady: true, error: trialError, retryTrial } });

    const context = getContext() as DeploymentFlowContext;
    expect(context.flow).toBe(flow);
    expect(context.isWalletReady).toBe(true);
    expect(context.trialError).toBe(trialError);
    expect(context.retryTrial).toBe(retryTrial);
  });

  it("renders its children", () => {
    setup({});

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  function intentFor(dseq: string | undefined): DeploymentIntent {
    return { sdlStrategy: "default", bidStrategy: "auto", dseq };
  }

  function setup(input: {
    intent?: DeploymentIntent;
    flow?: DeploymentFlow;
    trial?: { isWalletReady?: boolean; error?: Error | null; retryTrial?: () => void };
    useDeploymentFlow?: typeof DEPENDENCIES.useDeploymentFlow;
  }) {
    const flow = input.flow ?? mock<DeploymentFlow>();
    const useDeploymentFlow = input.useDeploymentFlow ?? vi.fn(() => flow);
    const trial = mock<ReturnType<typeof DEPENDENCIES.useEnsureTrialStarted>>({
      isWalletReady: input.trial?.isWalletReady ?? false,
      retryTrial: input.trial?.retryTrial ?? vi.fn()
    });
    // Assigned after construction: an Error passed inside the mock<T>() partial gets auto-mocked, losing its identity.
    trial.error = input.trial?.error ?? null;
    const useEnsureTrialStarted: typeof DEPENDENCIES.useEnsureTrialStarted = () => trial;

    let context: DeploymentFlowContext | undefined;
    const renderChild = (received: DeploymentFlowContext) => {
      context = received;
      return <div data-testid="child" />;
    };

    render(
      <DeploymentFlowProvider
        intent={input.intent ?? intentFor(undefined)}
        dependencies={{ useDeploymentFlow: useDeploymentFlow as never, useEnsureTrialStarted }}
      >
        {renderChild}
      </DeploymentFlowProvider>
    );

    return { getContext: () => context };
  }
});
