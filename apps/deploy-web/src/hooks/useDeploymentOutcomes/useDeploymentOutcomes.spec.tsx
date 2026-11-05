import type { ReactNode } from "react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useDeploymentOutcomes } from "./useDeploymentOutcomes";

import { act, renderHook } from "@testing-library/react";

describe(useDeploymentOutcomes.name, () => {
  it("records the outcome of a deployment", () => {
    const { result } = setup();

    act(() => result.current.recordOutcome("11", { outcome: "failed", failureReason: "No bids" }));

    expect(result.current.outcomes["11"]).toEqual({ outcome: "failed", failureReason: "No bids" });
  });

  it("replaces an outcome nobody was asked about yet", () => {
    const { result } = setup();

    act(() => result.current.recordOutcome("11", { outcome: "unknown" }));
    act(() => result.current.recordOutcome("11", { outcome: "live" }));

    expect(result.current.outcomes["11"]).toEqual({ outcome: "live", failureReason: undefined });
  });

  it("keeps the same state when the outcome did not change", () => {
    const { result } = setup();
    act(() => result.current.recordOutcome("11", { outcome: "failed", failureReason: "No bids" }));
    const recorded = result.current.outcomes;

    act(() => result.current.recordOutcome("11", { outcome: "failed", failureReason: "No bids" }));

    expect(result.current.outcomes).toBe(recorded);
  });

  it("keeps the outcome the user was already asked about", () => {
    const { result } = setup();
    act(() => result.current.recordOutcome("11", { outcome: "live" }));
    act(() => result.current.markPrompted("11"));

    act(() => result.current.recordOutcome("11", { outcome: "failed", failureReason: "Lease closed" }));

    expect(result.current.outcomes["11"]).toEqual({ outcome: "live", failureReason: undefined, isPrompted: true });
  });

  it("marks a deployment it never recorded as asked about", () => {
    const { result } = setup();

    act(() => result.current.markPrompted("12"));

    expect(result.current.outcomes["12"]).toEqual({ outcome: "unknown", failureReason: undefined, isPrompted: true });
  });

  function setup() {
    sessionStorage.clear();
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

    return renderHook(() => useDeploymentOutcomes(), { wrapper });
  }
});
