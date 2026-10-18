import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useHandledActivityOutcomes, useMarkActivityOutcomes } from "./useHandledActivityOutcomes";

import { act, renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";

describe(useHandledActivityOutcomes.name, () => {
  it("knows no outcome as handled before a page marks one", () => {
    const { result } = setup();

    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } }))).toBe(false);
  });

  it("knows the outcome a page marked as handled by the type, deployment and status of its activity", () => {
    const { result } = setup();

    act(() => result.current.markOutcomeHandled("lease_create", "1234", "succeeded"));

    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } }))).toBe(true);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "1234" } }))).toBe(false);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "deployment_create", status: "succeeded", meta: { dseq: "1234" } }))).toBe(false);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "5678" } }))).toBe(false);
  });

  it("forgets only the handled outcome it is told to", () => {
    const { result } = setup();
    const deployed = buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } });
    const created = buildActivity({ type: "deployment_create", status: "succeeded", meta: { dseq: "1234" } });

    act(() => {
      result.current.markOutcomeHandled("lease_create", "1234", "succeeded");
      result.current.markOutcomeHandled("deployment_create", "1234", "succeeded");
    });
    act(() => result.current.forgetHandledOutcome(deployed));

    expect(result.current.isOutcomeHandled(deployed)).toBe(false);
    expect(result.current.isOutcomeHandled(created)).toBe(true);
  });

  it("drops every outcome an earlier attempt of the same action marked, and only those", () => {
    const { result } = setup();

    act(() => {
      result.current.markOutcomeHandled("lease_create", "1234", "failed");
      result.current.markOutcomeHandled("lease_create", "1234", "succeeded");
      result.current.markOutcomeHandled("lease_create", "12345", "failed");
      result.current.markOutcomeHandled("deployment_update", "1234", "failed");
    });
    act(() => result.current.forgetEarlierOutcomes("lease_create", "1234"));

    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "1234" } }))).toBe(false);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } }))).toBe(false);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "failed", meta: { dseq: "12345" } }))).toBe(true);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1234" } }))).toBe(true);
  });

  function setup() {
    const store = createStore();

    return renderHook(() => ({ ...useHandledActivityOutcomes(), ...useMarkActivityOutcomes() }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });
  }
});
