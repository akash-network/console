import { describe, expect, it } from "vitest";

import {
  DEPLOY_ERRORED_REASON,
  deployFlowOutcomeOf,
  LAUNCH_FAILED_REASON,
  LEASE_CLOSED_EARLY_REASON,
  NO_BIDS_REASON,
  observedDeploymentOutcomeOf,
  promptableOutcomeOf
} from "./deploymentOutcome";

describe(deployFlowOutcomeOf.name, () => {
  it("reads a deploy the page finished itself as live", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", deploySucceeded: true }), "11")).toEqual({ dseq: "11", outcome: "live" });
  });

  it("leaves a lease the api finishes in the background for the deployment page to read", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", deploySucceeded: true, isDeployedInBackground: true }), "11")).toEqual({ dseq: "11", outcome: "unknown" });
  });

  it("leaves a one-click deploy the api leases by itself for the deployment page to read", () => {
    expect(deployFlowOutcomeOf(flow({ autoLeasedDseq: "12" }), null)).toEqual({ dseq: "12", outcome: "unknown" });
  });

  it("reads a deploy error as a failure carrying its message", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", deployError: { message: "The selected bid is no longer open" } }), "11")).toEqual({
      dseq: "11",
      outcome: "failed",
      failureReason: "The selected bid is no longer open"
    });
  });

  it("falls back to a generic reason for a deploy error without a message", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", deployError: {} }), "11")).toEqual({ dseq: "11", outcome: "failed", failureReason: DEPLOY_ERRORED_REASON });
  });

  it("reads a bid window that closed without bids as a failure", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", noBidsReceived: true }), "11")).toEqual({ dseq: "11", outcome: "failed", failureReason: NO_BIDS_REASON });
  });

  it("reads an errored flow that still holds its deployment as a failure", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", phase: "error", error: { message: "No provider can run this" } }), "11")).toEqual({
      dseq: "11",
      outcome: "failed",
      failureReason: "No provider can run this"
    });
  });

  it("names the deployment an abandoned attempt closed", () => {
    expect(deployFlowOutcomeOf(flow({ phase: "error", error: { message: "No match" } }), "11")).toEqual({
      dseq: "11",
      outcome: "failed",
      failureReason: "No match"
    });
  });

  it("falls back to a generic reason for an abandoned attempt without a message", () => {
    expect(deployFlowOutcomeOf(flow({ phase: "error" }), "11")).toEqual({ dseq: "11", outcome: "failed", failureReason: DEPLOY_ERRORED_REASON });
  });

  it("falls back to a generic reason for an errored flow without a message", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", phase: "error" }), "11")).toEqual({ dseq: "11", outcome: "failed", failureReason: DEPLOY_ERRORED_REASON });
  });

  it("reads nothing from an error that left no deployment", () => {
    expect(deployFlowOutcomeOf(flow({ phase: "error" }), null)).toBeUndefined();
  });

  it("reads nothing while the deployment is still quoting", () => {
    expect(deployFlowOutcomeOf(flow({ dseq: "11", phase: "quoting" }), "11")).toBeUndefined();
  });

  it("reads nothing from a flow without a deployment outside of an error", () => {
    expect(deployFlowOutcomeOf(flow({ phase: "configuring" }), "11")).toBeUndefined();
  });

  function flow(input: Partial<Parameters<typeof deployFlowOutcomeOf>[0]>): Parameters<typeof deployFlowOutcomeOf>[0] {
    return {
      phase: "quoting",
      dseq: null,
      autoLeasedDseq: null,
      deploySucceeded: false,
      isDeployedInBackground: false,
      deployError: undefined,
      noBidsReceived: false,
      error: undefined,
      ...input
    };
  }
});

describe(observedDeploymentOutcomeOf.name, () => {
  it("reads a failed launch as a failure carrying its reason", () => {
    expect(
      observedDeploymentOutcomeOf({
        createdHeight: 100,
        leases: [],
        launch: { phase: "failed", providers: [], recovery: "send-again", reason: "Manifest not delivered" }
      })
    ).toEqual({ outcome: "failed", failureReason: "Manifest not delivered" });
  });

  it("falls back to a generic reason for a failed launch without one", () => {
    expect(observedDeploymentOutcomeOf({ createdHeight: 100, leases: [], launch: { phase: "failed", providers: [], recovery: "send-again" } })).toEqual({
      outcome: "failed",
      failureReason: LAUNCH_FAILED_REASON
    });
  });

  it("reads a lease closed within the first hour as a failure", () => {
    expect(observedDeploymentOutcomeOf({ createdHeight: 100, leases: [{ state: "closed", closedOn: "690" }], launch: undefined })).toEqual({
      outcome: "failed",
      failureReason: LEASE_CLOSED_EARLY_REASON
    });
  });

  it("reads a lease closed after the first hour as no outcome", () => {
    expect(observedDeploymentOutcomeOf({ createdHeight: 100, leases: [{ state: "closed", closedOn: "800" }], launch: undefined })).toBeUndefined();
  });

  it("reads a lease out of funds that never closed as no outcome", () => {
    expect(observedDeploymentOutcomeOf({ createdHeight: 100, leases: [{ state: "insufficient_funds", closedOn: "0" }], launch: undefined })).toBeUndefined();
  });

  it("reads an early close as a failure even beside a live lease", () => {
    expect(
      observedDeploymentOutcomeOf({
        createdHeight: 100,
        leases: [
          { state: "active", closedOn: "0" },
          { state: "closed", closedOn: "150" }
        ],
        launch: undefined
      })
    ).toEqual({ outcome: "failed", failureReason: LEASE_CLOSED_EARLY_REASON });
  });

  it("reads a live lease as live", () => {
    expect(observedDeploymentOutcomeOf({ createdHeight: 100, leases: [{ state: "active", closedOn: "0" }], launch: undefined })).toEqual({ outcome: "live" });
  });

  it("reads nothing while no lease is there yet", () => {
    expect(observedDeploymentOutcomeOf({ createdHeight: 100, leases: [], launch: { phase: "starting", providers: [] } })).toBeUndefined();
  });
});

describe(promptableOutcomeOf.name, () => {
  it("asks nothing about a deployment this tab never deployed", () => {
    expect(promptableOutcomeOf(undefined, { outcome: "live" })).toBeUndefined();
  });

  it("asks nothing about a deployment already asked about", () => {
    expect(promptableOutcomeOf({ outcome: "live", isPrompted: true }, { outcome: "live" })).toBeUndefined();
  });

  it("prefers a failure seen on the page over a recorded success", () => {
    expect(promptableOutcomeOf({ outcome: "live" }, { outcome: "failed", failureReason: LEASE_CLOSED_EARLY_REASON })).toEqual({
      outcome: "failed",
      failureReason: LEASE_CLOSED_EARLY_REASON
    });
  });

  it("asks about the outcome the deploy flow recorded", () => {
    expect(promptableOutcomeOf({ outcome: "failed", failureReason: NO_BIDS_REASON }, undefined)).toEqual({ outcome: "failed", failureReason: NO_BIDS_REASON });
  });

  it("asks about a background deploy once the page sees how it went", () => {
    expect(promptableOutcomeOf({ outcome: "unknown" }, { outcome: "live" })).toEqual({ outcome: "live" });
  });

  it("waits on a background deploy the page can't read yet", () => {
    expect(promptableOutcomeOf({ outcome: "unknown" }, undefined)).toBeUndefined();
  });
});
