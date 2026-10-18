import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES, DeploymentFlowContext } from "./DeploymentFlowProvider";
import { DeploymentFlowProvider, useDeploymentLeaveGuard, useIsDeploymentCreating } from "./DeploymentFlowProvider";

import { fireEvent, render, renderHook, screen } from "@testing-library/react";

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
    const { useWarnBeforeUnload } = setup({ flow: mock<DeploymentFlow>({ phase: "creating", isCreatingInBackground: false }) });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(true);
  });

  it("lets the page unload unwarned once the deployment is quoting", () => {
    const { useWarnBeforeUnload } = setup({ flow: mock<DeploymentFlow>({ phase: "quoting", isCreatingInBackground: false }) });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(false);
  });

  it("lets the page unload unwarned once the api finishes the create in the background", () => {
    const { useWarnBeforeUnload } = setup({ flow: mock<DeploymentFlow>({ phase: "creating", isCreatingInBackground: true }) });

    expect(useWarnBeforeUnload).toHaveBeenLastCalledWith(false);
  });

  it("tells its descendants while the deployment is being created", () => {
    setup({ flow: mock<DeploymentFlow>({ phase: "creating", isCreatingInBackground: false }) });

    expect(screen.getByTestId("creating")).toHaveTextContent("true");
  });

  it("tells its descendants no deployment is being created once it is quoting", () => {
    setup({ flow: mock<DeploymentFlow>({ phase: "quoting", isCreatingInBackground: false }) });

    expect(screen.getByTestId("creating")).toHaveTextContent("false");
  });

  it("frees its descendants to navigate away once the api finishes the create in the background", () => {
    setup({ flow: mock<DeploymentFlow>({ phase: "creating", isCreatingInBackground: true }) });

    expect(screen.getByTestId("creating")).toHaveTextContent("false");
  });

  it.each([
    ["quoting", { phase: "quoting" }, true],
    ["leasing", { phase: "deploying" }, true],
    ["leased", { phase: "deploying", deploySucceeded: true }, false],
    ["quoting a deployment the api created in the background", { phase: "quoting", isCreatingInBackground: true }, false],
    ["configuring", { phase: "configuring" }, false],
    ["creating", { phase: "creating" }, false],
    ["in error", { phase: "error" }, false]
  ] as const)("tells its descendants whether a deployment without a lease is held while %s", (_, state, holdsUnleasedDeployment) => {
    setup({ flow: flowIn(state) });

    expect(screen.getByTestId("holds-unleased-deployment")).toHaveTextContent(String(holdsUnleasedDeployment));
  });

  it("tells its descendants once the deployment they guarded got its lease", () => {
    const { rerenderWith } = setup({ flow: flowIn({ phase: "deploying" }) });

    rerenderWith(flowIn({ phase: "deploying", deploySucceeded: true }));

    expect(screen.getByTestId("holds-unleased-deployment")).toHaveTextContent("false");
  });

  it("lets its descendants discard the deployment through the flow", () => {
    const flow = flowIn({ phase: "quoting" });
    setup({ flow });

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(flow.actions.discard).toHaveBeenCalled();
  });

  describe(useDeploymentLeaveGuard.name, () => {
    it("guards nothing outside the provider", () => {
      const { result } = renderHook(() => useDeploymentLeaveGuard());

      expect(result.current).toMatchObject({ isCreating: false, holdsUnleasedDeployment: false });
      expect(() => result.current.discard()).not.toThrow();
    });
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

  function flowIn(state: Partial<Pick<DeploymentFlow, "phase" | "deploySucceeded" | "isCreatingInBackground">>): DeploymentFlow {
    return mock<DeploymentFlow>({ isCreatingInBackground: false, deploySucceeded: false, actions: mock<DeploymentFlowActions>(), ...state });
  }

  function setup(input: { intent?: DeploymentIntent; flow?: DeploymentFlow; useDeploymentFlow?: typeof DEPENDENCIES.useDeploymentFlow }) {
    let flow = input.flow ?? mock<DeploymentFlow>();
    const useDeploymentFlow = input.useDeploymentFlow ?? vi.fn(() => flow);
    const useWarnBeforeUnload = vi.fn();

    let context: DeploymentFlowContext | undefined;
    const renderChild = (received: DeploymentFlowContext) => {
      context = received;
      return (
        <div data-testid="child">
          <CreatingProbe />
          <LeaveGuardProbe />
        </div>
      );
    };

    const provider = () => (
      <DeploymentFlowProvider
        intent={input.intent ?? intentFor(undefined)}
        dependencies={{ useDeploymentFlow: useDeploymentFlow as never, useWarnBeforeUnload }}
      >
        {renderChild}
      </DeploymentFlowProvider>
    );
    const { rerender } = render(provider());
    const rerenderWith = (nextFlow: DeploymentFlow) => {
      flow = nextFlow;
      rerender(provider());
    };

    return { getContext: () => context, useWarnBeforeUnload, rerenderWith };
  }

  function CreatingProbe() {
    return <span data-testid="creating">{String(useIsDeploymentCreating())}</span>;
  }

  function LeaveGuardProbe() {
    const { holdsUnleasedDeployment, discard } = useDeploymentLeaveGuard();
    return (
      <>
        <span data-testid="holds-unleased-deployment">{String(holdsUnleasedDeployment)}</span>
        <button type="button" onClick={discard}>
          Discard
        </button>
      </>
    );
  }
});
