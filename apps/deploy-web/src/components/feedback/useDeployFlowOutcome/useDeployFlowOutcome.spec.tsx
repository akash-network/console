import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DeploymentFlow } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { NO_BIDS_REASON } from "../deploymentOutcome/deploymentOutcome";
import type { DEPENDENCIES } from "./useDeployFlowOutcome";
import { useDeployFlowOutcome } from "./useDeployFlowOutcome";

import { renderHook } from "@testing-library/react";

describe(useDeployFlowOutcome.name, () => {
  it("records a deploy the page finished as live without asking about it here", () => {
    const { result, recordOutcome } = setup({ flow: flowWith({ dseq: "11", phase: "deploying", deploySucceeded: true }) });

    expect(recordOutcome).toHaveBeenCalledWith("11", { outcome: "live", failureReason: undefined });
    expect(result.current).toBeUndefined();
  });

  it("records a failure and returns it to ask about here", () => {
    const { result, recordOutcome } = setup({ flow: flowWith({ dseq: "11", noBidsReceived: true }) });

    expect(recordOutcome).toHaveBeenCalledWith("11", { outcome: "failed", failureReason: NO_BIDS_REASON });
    expect(result.current).toEqual({ dseq: "11", outcome: "failed", failureReason: NO_BIDS_REASON });
  });

  it("records nothing for a deploy error the user can still recover from", () => {
    const { result, recordOutcome } = setup({ flow: flowWith({ dseq: "11", deployError: { message: "The selected bid is no longer open" } }) });

    expect(recordOutcome).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("records nothing while the deployment is still quoting", () => {
    const { result, recordOutcome } = setup({ flow: flowWith({ dseq: "11" }) });

    expect(recordOutcome).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  it("remembers the deployment an abandoned attempt closed", () => {
    const { result, rerenderWith, recordOutcome } = setup({ flow: flowWith({ dseq: "11" }) });

    rerenderWith(flowWith({ dseq: null, phase: "error", error: { message: "No provider matched" } }));

    expect(recordOutcome).toHaveBeenCalledWith("11", { outcome: "failed", failureReason: "No provider matched" });
    expect(result.current).toEqual({ dseq: "11", outcome: "failed", failureReason: "No provider matched" });
  });

  it("forgets the closed deployment once the form starts over", () => {
    const { result, rerenderWith, recordOutcome } = setup({ flow: flowWith({ dseq: "11" }) });

    rerenderWith(flowWith({ dseq: null, phase: "configuring" }));
    rerenderWith(flowWith({ dseq: null, phase: "error", error: { message: "Create failed" } }));

    expect(recordOutcome).not.toHaveBeenCalled();
    expect(result.current).toBeUndefined();
  });

  function flowWith(input: Partial<DeploymentFlow>) {
    return mock<DeploymentFlow>({
      phase: "quoting",
      dseq: null,
      autoLeasedDseq: null,
      deploySucceeded: false,
      isDeployedInBackground: false,
      deployError: undefined,
      noBidsReceived: false,
      error: undefined,
      ...input
    });
  }

  function setup(input: { flow: DeploymentFlow }) {
    const recordOutcome = vi.fn();
    const dependencies: typeof DEPENDENCIES = {
      useDeploymentOutcomes: () => ({ outcomes: {}, recordOutcome, markPrompted: vi.fn() })
    };
    const { result, rerender } = renderHook(({ flow }) => useDeployFlowOutcome(flow, dependencies), { initialProps: { flow: input.flow } });

    return { result, recordOutcome, rerenderWith: (flow: DeploymentFlow) => rerender({ flow }) };
  }
});
