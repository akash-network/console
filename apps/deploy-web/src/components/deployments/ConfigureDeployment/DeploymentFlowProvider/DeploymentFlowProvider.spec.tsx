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

  it("exposes the flow to its children", () => {
    const flow = mock<DeploymentFlow>();
    const { getContext } = setup({ flow });

    const context = getContext() as DeploymentFlowContext;
    expect(context.flow).toBe(flow);
  });

  it("renders its children", () => {
    setup({});

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  function intentFor(dseq: string | undefined): DeploymentIntent {
    return { sdlStrategy: "default", bidStrategy: "auto", dseq, vm: false };
  }

  function setup(input: { intent?: DeploymentIntent; flow?: DeploymentFlow; useDeploymentFlow?: typeof DEPENDENCIES.useDeploymentFlow }) {
    const flow = input.flow ?? mock<DeploymentFlow>();
    const useDeploymentFlow = input.useDeploymentFlow ?? vi.fn(() => flow);

    let context: DeploymentFlowContext | undefined;
    const renderChild = (received: DeploymentFlowContext) => {
      context = received;
      return <div data-testid="child" />;
    };

    render(
      <DeploymentFlowProvider intent={input.intent ?? intentFor(undefined)} dependencies={{ useDeploymentFlow: useDeploymentFlow as never }}>
        {renderChild}
      </DeploymentFlowProvider>
    );

    return { getContext: () => context };
  }
});
