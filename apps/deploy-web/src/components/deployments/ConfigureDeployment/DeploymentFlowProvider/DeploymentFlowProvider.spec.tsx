import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES, DeploymentFlowContext } from "./DeploymentFlowProvider";
import { DeploymentFlowProvider, useIsDeploymentCreating } from "./DeploymentFlowProvider";

import { render, renderHook, screen } from "@testing-library/react";

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

  it("warns before the page unloads while the deployment is being created", () => {
    const { useWarnBeforeUnload } = setup({ flow: mock<DeploymentFlow>({ phase: "creating" }) });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(true);
  });

  it("lets the page unload unwarned once the deployment is quoting", () => {
    const { useWarnBeforeUnload } = setup({ flow: mock<DeploymentFlow>({ phase: "quoting" }) });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(false);
  });

  it("tells its descendants while the deployment is being created", () => {
    setup({ flow: mock<DeploymentFlow>({ phase: "creating" }) });

    expect(screen.getByTestId("creating")).toHaveTextContent("true");
  });

  it("tells its descendants no deployment is being created once it is quoting", () => {
    setup({ flow: mock<DeploymentFlow>({ phase: "quoting" }) });

    expect(screen.getByTestId("creating")).toHaveTextContent("false");
  });

  describe(useIsDeploymentCreating.name, () => {
    it("reports no deployment being created outside the provider", () => {
      const { result } = renderHook(() => useIsDeploymentCreating());

      expect(result.current).toBe(false);
    });
  });

  function intentFor(dseq: string | undefined): DeploymentIntent {
    return { sdlStrategy: "default", bidStrategy: "auto", dseq, vm: false };
  }

  function setup(input: { intent?: DeploymentIntent; flow?: DeploymentFlow; useDeploymentFlow?: typeof DEPENDENCIES.useDeploymentFlow }) {
    const flow = input.flow ?? mock<DeploymentFlow>();
    const useDeploymentFlow = input.useDeploymentFlow ?? vi.fn(() => flow);
    const useWarnBeforeUnload = vi.fn();

    let context: DeploymentFlowContext | undefined;
    const renderChild = (received: DeploymentFlowContext) => {
      context = received;
      return (
        <div data-testid="child">
          <CreatingProbe />
        </div>
      );
    };

    render(
      <DeploymentFlowProvider
        intent={input.intent ?? intentFor(undefined)}
        dependencies={{ useDeploymentFlow: useDeploymentFlow as never, useWarnBeforeUnload }}
      >
        {renderChild}
      </DeploymentFlowProvider>
    );

    return { getContext: () => context, useWarnBeforeUnload };
  }

  function CreatingProbe() {
    return <span data-testid="creating">{String(useIsDeploymentCreating())}</span>;
  }
});
