import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./useFollowedActivities";
import { useDeploymentsWithPendingActivity, useFollowedActivities, useNewestDeploymentUpdate } from "./useFollowedActivities";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useFollowedActivities.name, () => {
  it("reads the feed for a signed-in user", () => {
    const activities = [buildActivity()];
    const { useLatestActivitiesQuery, dependencies } = setup({ activities });

    const { result } = renderHook(() => useFollowedActivities(dependencies));

    expect(result.current).toBe(activities);
    expect(useLatestActivitiesQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("reads nothing, not even activities still cached, while no one is signed in", () => {
    const { useLatestActivitiesQuery, dependencies } = setup({ activities: [buildActivity()], isSignedIn: false });

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

  describe(useNewestDeploymentUpdate.name, () => {
    it("finds the newest update of the deployment, whatever became of it", () => {
      const newest = buildActivity({ type: "deployment_update", status: "succeeded", meta: { dseq: "1001" } });
      const { dependencies } = setup({
        activities: [
          buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "1001" } }),
          buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "2002" } }),
          newest,
          buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1001" } })
        ]
      });

      const { result } = renderHook(() => useNewestDeploymentUpdate("1001", dependencies));

      expect(result.current).toBe(newest);
    });

    it("finds nothing for a deployment not known yet", () => {
      const { dependencies } = setup({ activities: [buildActivity({ type: "deployment_update", status: "pending", meta: {} })] });

      const { result } = renderHook(() => useNewestDeploymentUpdate(undefined, dependencies));

      expect(result.current).toBeUndefined();
    });
  });

  function setup(input: { activities?: Activity[]; isSignedIn?: boolean }) {
    const useLatestActivitiesQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), {
        data: input.activities
      })) as typeof DEPENDENCIES.useLatestActivitiesQuery);
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useLatestActivitiesQuery
    };

    return { useLatestActivitiesQuery, dependencies };
  }
});
