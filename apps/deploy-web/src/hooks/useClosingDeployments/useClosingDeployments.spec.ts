import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./useClosingDeployments";
import { useClosingDeployments } from "./useClosingDeployments";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useClosingDeployments.name, () => {
  it("lists the deployments whose close is still pending", () => {
    const { result } = setup({
      activities: [
        buildActivity({ status: "pending", meta: { dseq: "1001" } }),
        buildActivity({ status: "succeeded", meta: { dseq: "1002" } }),
        buildActivity({ status: "failed", meta: { dseq: "1003" } }),
        buildActivity({ status: "pending", meta: { dseq: "1004" } })
      ]
    });

    expect(result.current).toEqual(new Set(["1001", "1004"]));
  });

  it("lists nothing before the activities have loaded", () => {
    const { result } = setup({ activities: undefined });

    expect(result.current).toEqual(new Set());
  });

  it.each([
    { case: "the activity center is off", isEnabled: false, isSignedIn: true },
    { case: "no one is signed in", isEnabled: true, isSignedIn: false }
  ])("lists nothing from activities still cached once $case", ({ isEnabled, isSignedIn }) => {
    const { result } = setup({ activities: [buildActivity({ status: "pending", meta: { dseq: "1001" } })], isEnabled, isSignedIn });

    expect(result.current).toEqual(new Set());
  });

  it("follows the feed as a close starts and then lands", () => {
    const pending = buildActivity({ status: "pending", meta: { dseq: "1001" } });
    const { result, receive } = setup({ activities: [] });

    receive([pending]);
    const whileRunning = result.current;
    receive([{ ...pending, status: "succeeded" }]);

    expect(whileRunning).toEqual(new Set(["1001"]));
    expect(result.current).toEqual(new Set());
  });

  it("reads the activities the activity host follows, only while the activity center is on for a signed-in user", () => {
    expect(setup({ isEnabled: true }).useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: true });
    expect(setup({ isEnabled: false }).useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: false });
    expect(setup({ isSignedIn: false }).useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: false });
  });

  function setup(input: { activities?: Activity[]; isEnabled?: boolean; isSignedIn?: boolean }) {
    let activities = input.activities;
    const useLatestActivitiesQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), {
        data: activities
      })) as typeof DEPENDENCIES.useLatestActivitiesQuery);
    const dependencies: typeof DEPENDENCIES = {
      useFlag: vi.fn((flag: string) => flag === "notifications_activity_center" && (input.isEnabled ?? true)) as typeof DEPENDENCIES.useFlag,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useLatestActivitiesQuery
    };

    const { result, rerender } = renderHook(() => useClosingDeployments(dependencies));

    const receive = (next: Activity[]) => {
      activities = next;
      rerender();
    };

    return { result, useLatestActivitiesQuery, receive };
  }
});
