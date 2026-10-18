import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";

import { useHandledActivityOutcomes, useMarkActivityOutcomeHandled } from "./useHandledActivityOutcomes";

import { act, renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";

describe(useHandledActivityOutcomes.name, () => {
  it("knows no outcome as handled before a page marks one", () => {
    const { result } = setup();

    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", meta: { dseq: "1234" } }))).toBe(false);
  });

  it("knows the outcome a page marked as handled by the type and deployment of its activity", () => {
    const { result } = setup();

    act(() => result.current.markOutcomeHandled("lease_create", "1234"));

    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } }))).toBe(true);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "deployment_create", status: "succeeded", meta: { dseq: "1234" } }))).toBe(false);
    expect(result.current.isOutcomeHandled(buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "5678" } }))).toBe(false);
  });

  it("forgets only the handled outcome it is told to", () => {
    const { result } = setup();
    const deployed = buildActivity({ type: "lease_create", status: "succeeded", meta: { dseq: "1234" } });
    const created = buildActivity({ type: "deployment_create", status: "succeeded", meta: { dseq: "1234" } });

    act(() => {
      result.current.markOutcomeHandled("lease_create", "1234");
      result.current.markOutcomeHandled("deployment_create", "1234");
    });
    act(() => result.current.forgetHandledOutcome(deployed));

    expect(result.current.isOutcomeHandled(deployed)).toBe(false);
    expect(result.current.isOutcomeHandled(created)).toBe(true);
  });

  function setup() {
    const store = createStore();

    return renderHook(() => ({ ...useHandledActivityOutcomes(), markOutcomeHandled: useMarkActivityOutcomeHandled() }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });
  }
});
