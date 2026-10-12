import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./useFollowedActivities";
import { useDeploymentsWithPendingActivity, useFollowedActivities } from "./useFollowedActivities";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useFollowedActivities.name, () => {
  it("reads the feed while the activity center is on for a signed-in user", () => {
    const activities = [buildActivity()];
    const { useLatestActivitiesQuery, dependencies } = setup({ activities });

    const { result } = renderHook(() => useFollowedActivities(dependencies));

    expect(result.current).toBe(activities);
    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it.each([
    { case: "the activity center is off", isEnabled: false, isSignedIn: true },
    { case: "no one is signed in", isEnabled: true, isSignedIn: false }
  ])("reads nothing, not even activities still cached, once $case", ({ isEnabled, isSignedIn }) => {
    const { useLatestActivitiesQuery, dependencies } = setup({ activities: [buildActivity()], isEnabled, isSignedIn });

    const { result } = renderHook(() => useFollowedActivities(dependencies));

    expect(result.current).toBeUndefined();
    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: false });
  });

  describe(useDeploymentsWithPendingActivity.name, () => {
    it("lists the deployments with a pending action of the given type only", () => {
      const { dependencies } = setup({
        activities: [
          buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1001" } }),
          buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "1002" } }),
          buildActivity({ type: "deployment_update", status: "succeeded", meta: { dseq: "1003" } }),
          buildActivity({ type: "deployment_update", status: "pending", meta: {} })
        ]
      });

      const { result } = renderHook(() => useDeploymentsWithPendingActivity("deployment_update", dependencies));

      expect(result.current).toEqual(new Set(["1001"]));
    });

    it("keeps the same list while the feed is unchanged", () => {
      const { dependencies } = setup({ activities: [buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1001" } })] });
      const { result, rerender } = renderHook(() => useDeploymentsWithPendingActivity("deployment_update", dependencies));
      const first = result.current;

      rerender();

      expect(result.current).toBe(first);
    });
  });

  function setup(input: { activities?: Activity[]; isEnabled?: boolean; isSignedIn?: boolean }) {
    const useLatestActivitiesQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), {
        data: input.activities
      })) as typeof DEPENDENCIES.useLatestActivitiesQuery);
    const dependencies: typeof DEPENDENCIES = {
      useFlag: vi.fn((flag: string) => flag === "notifications_activity_center" && (input.isEnabled ?? true)) as typeof DEPENDENCIES.useFlag,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useLatestActivitiesQuery
    };

    return { useLatestActivitiesQuery, dependencies };
  }
});
