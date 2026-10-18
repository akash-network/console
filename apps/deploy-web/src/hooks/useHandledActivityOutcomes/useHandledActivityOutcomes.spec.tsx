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

  it("knows an activity a page follows until it settles, whatever it ends as, and only that activity", () => {
    const { result } = setup();

    act(() => result.current.followUntilSettled("activity-1"));

    expect(result.current.isFollowedOnItsPage(buildActivity({ id: "activity-1", type: "deployment_create", status: "succeeded" }))).toBe(true);
    expect(result.current.isFollowedOnItsPage(buildActivity({ id: "activity-1", type: "deployment_create", status: "failed" }))).toBe(true);
    expect(result.current.isFollowedOnItsPage(buildActivity({ id: "activity-2", type: "deployment_create", status: "succeeded" }))).toBe(false);
    expect(result.current.isOutcomeHandled(buildActivity({ id: "activity-1", type: "deployment_create", status: "succeeded" }))).toBe(false);
  });

  it("stops knowing an activity once its page stops following it, leaving the others", () => {
    const { result } = setup();

    act(() => {
      result.current.followUntilSettled("activity-1");
      result.current.followUntilSettled("activity-2");
    });
    act(() => result.current.stopFollowing("activity-1"));

    expect(result.current.isFollowedOnItsPage(buildActivity({ id: "activity-1" }))).toBe(false);
    expect(result.current.isFollowedOnItsPage(buildActivity({ id: "activity-2" }))).toBe(true);
  });

  it("forgets that a page followed an activity along with the outcome it showed", () => {
    const { result } = setup();
    const created = buildActivity({ id: "activity-1", type: "deployment_create", status: "succeeded", meta: { dseq: "1234" } });

    act(() => {
      result.current.followUntilSettled("activity-1");
      result.current.markOutcomeHandled("deployment_create", "1234", "succeeded");
    });
    act(() => result.current.forgetHandledOutcome(created));

    expect(result.current.isFollowedOnItsPage(created)).toBe(false);
    expect(result.current.isOutcomeHandled(created)).toBe(false);
  });

  function setup() {
    const store = createStore();

    return renderHook(() => ({ ...useHandledActivityOutcomes(), ...useMarkActivityOutcomes() }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>
    });
  }
});
