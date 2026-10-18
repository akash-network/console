import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./useUpdatingDeployments";
import { useUpdatingDeployments } from "./useUpdatingDeployments";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useUpdatingDeployments.name, () => {
  it("lists the deployments whose update is still being applied, leaving out those closing", () => {
    const { result } = setup({
      activities: [
        buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1001" } }),
        buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1002" } }),
        buildActivity({ type: "deployment_close", status: "pending", meta: { dseq: "1003" } })
      ]
    });

    expect(result.current).toEqual(new Set(["1001"]));
  });

  it("follows the feed as an update starts and then lands, so a reload or another tab shows it too", () => {
    const pending = buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1001" } });
    const { result, receive } = setup({ activities: [] });

    receive([pending]);
    const whileApplying = result.current;
    receive([{ ...pending, status: "succeeded" }]);

    expect(whileApplying).toEqual(new Set(["1001"]));
    expect(result.current).toEqual(new Set());
  });

  it("lists nothing while the activity center is off", () => {
    const { result } = setup({ activities: [buildActivity({ type: "deployment_update", status: "pending", meta: { dseq: "1001" } })], isEnabled: false });

    expect(result.current).toEqual(new Set());
  });

  function setup(input: { activities?: Activity[]; isEnabled?: boolean }) {
    let activities = input.activities;
    const dependencies: typeof DEPENDENCIES = {
      useFlag: vi.fn((flag: string) => flag === "notifications_activity_center" && (input.isEnabled ?? true)) as typeof DEPENDENCIES.useFlag,
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: buildUser() }),
      useLatestActivitiesQuery: (() =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), { data: activities })) as typeof DEPENDENCIES.useLatestActivitiesQuery
    };

    const { result, rerender } = renderHook(() => useUpdatingDeployments(dependencies));

    const receive = (next: Activity[]) => {
      activities = next;
      rerender();
    };

    return { result, receive };
  }
});
