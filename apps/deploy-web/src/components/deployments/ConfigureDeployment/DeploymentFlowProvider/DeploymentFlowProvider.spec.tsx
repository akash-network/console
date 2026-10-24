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
    ["waiting on a lease already sent", { phase: "deploying", isLeaseInFlight: true }, false],
    [
      "waiting on a lease already sent after a close failed",
      { phase: "deploying", isLeaseInFlight: true, pendingClose: { dseq: "1234", failed: true } },
      false
    ],
    ["leased", { phase: "deploying", deploySucceeded: true }, false],
    ["quoting a deployment the api created in the background", { phase: "quoting", isCreatingInBackground: true }, false],
    ["configuring", { phase: "configuring" }, false],
    ["creating", { phase: "creating" }, false],
    ["in error", { phase: "error" }, false],
    ["in error with its deployment still open", { phase: "error", dseq: "1234" }, true],
    ["in error after a close failed", { phase: "error", pendingClose: { dseq: "1234", failed: true } }, true],
    ["configuring after a close failed", { phase: "configuring", pendingClose: { dseq: "1234", failed: true } }, true],
    ["configuring while a close settles", { phase: "configuring", pendingClose: { dseq: "1234", failed: false } }, false]
  ] as const)("tells its descendants whether a deployment without a lease is held while %s", (_, state, holdsUnleasedDeployment) => {
    setup({ flow: flowIn(state) });

    expect(screen.getByTestId("holds-unleased-deployment")).toHaveTextContent(String(holdsUnleasedDeployment));
  });

  it("tells its descendants once the deployment they guarded got its lease", () => {
    const { rerenderWith } = setup({ flow: flowIn({ phase: "deploying" }) });

    rerenderWith(flowIn({ phase: "deploying", deploySucceeded: true }));

    expect(screen.getByTestId("holds-unleased-deployment")).toHaveTextContent("false");
  });

  it.each([true, false])("tells its descendants whether a lease is in flight (%s)", isLeaseInFlight => {
    setup({ flow: flowIn({ phase: "deploying", isLeaseInFlight }) });

    expect(screen.getByTestId("lease-in-flight")).toHaveTextContent(String(isLeaseInFlight));
  });

  it("lets its descendants discard the deployment through the flow", () => {
    const flow = flowIn({ phase: "quoting" });
    setup({ flow });

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(flow.actions.discard).toHaveBeenCalled();
  });

  it("tells the user the deployment was created once the api has taken its lease on in the background", () => {
    const { enqueueSnackbar } = setup({ flow: flowIn({ phase: "deploying", isDeployedInBackground: true }) });

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: { title: "Deployment created", subTitle: "It's spinning up. We'll let you know when it's ready.", iconVariant: "success" }
      }),
      { variant: "success" }
    );
  });

  it("says nothing about a deployment whose lease the api has not taken on in the background", () => {
    const { enqueueSnackbar } = setup({ flow: flowIn({ phase: "deploying", isDeployedInBackground: false }) });

    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("tells the user once however often the flow renders after the hand-off", () => {
    const flow = flowIn({ phase: "deploying", isDeployedInBackground: true });
    const { enqueueSnackbar, rerenderWith } = setup({ flow });

    rerenderWith(flow);
    rerenderWith(flow);

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  it("tells the user once the api takes on the lease of a deploy that was already underway", () => {
    const { enqueueSnackbar, rerenderWith } = setup({ flow: flowIn({ phase: "deploying", isDeployedInBackground: false }) });

    rerenderWith(flowIn({ phase: "deploying", isDeployedInBackground: true }));

    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
  });

  describe(useDeploymentLeaveGuard.name, () => {
    it("guards nothing outside the provider", () => {
      const { result } = renderHook(() => useDeploymentLeaveGuard());

      expect(result.current).toMatchObject({ isCreating: false, holdsUnleasedDeployment: false, isLeaseInFlight: false });
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

  function flowIn(
    state: Partial<
      Pick<DeploymentFlow, "phase" | "deploySucceeded" | "isCreatingInBackground" | "isDeployedInBackground" | "dseq" | "pendingClose" | "isLeaseInFlight">
    >
  ): DeploymentFlow {
    return mock<DeploymentFlow>({
      isCreatingInBackground: false,
      isDeployedInBackground: false,
      isLeaseInFlight: false,
      deploySucceeded: false,
      dseq: null,
      pendingClose: null,
      actions: mock<DeploymentFlowActions>(),
      ...state
    });
  }

  function setup(input: { intent?: DeploymentIntent; flow?: DeploymentFlow; useDeploymentFlow?: typeof DEPENDENCIES.useDeploymentFlow }) {
    let flow = input.flow ?? mock<DeploymentFlow>();
    const useDeploymentFlow = input.useDeploymentFlow ?? vi.fn(() => flow);
    const useWarnBeforeUnload = vi.fn();
    const enqueueSnackbar = vi.fn();
    const useSnackbar = () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar });
    const Snackbar = vi.fn(() => null);

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

    const dependencies = { useDeploymentFlow: useDeploymentFlow as never, useWarnBeforeUnload, useSnackbar, Snackbar };
    const provider = () => (
      <DeploymentFlowProvider intent={input.intent ?? intentFor(undefined)} dependencies={dependencies}>
        {renderChild}
      </DeploymentFlowProvider>
    );
    const { rerender } = render(provider());
    const rerenderWith = (nextFlow: DeploymentFlow) => {
      flow = nextFlow;
      rerender(provider());
    };

    return { getContext: () => context, useWarnBeforeUnload, enqueueSnackbar, rerenderWith };
  }

  function CreatingProbe() {
    return <span data-testid="creating">{String(useIsDeploymentCreating())}</span>;
  }

  function LeaveGuardProbe() {
    const { holdsUnleasedDeployment, isLeaseInFlight, discard } = useDeploymentLeaveGuard();
    return (
      <>
        <span data-testid="holds-unleased-deployment">{String(holdsUnleasedDeployment)}</span>
        <span data-testid="lease-in-flight">{String(isLeaseInFlight)}</span>
        <button type="button" onClick={discard}>
          Discard
        </button>
      </>
    );
  }
});
