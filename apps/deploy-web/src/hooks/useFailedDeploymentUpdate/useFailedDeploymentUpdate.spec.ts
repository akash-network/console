import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./useFailedDeploymentUpdate";
import { useFailedDeploymentUpdate } from "./useFailedDeploymentUpdate";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useFailedDeploymentUpdate.name, () => {
  it("finds the deployment's newest update when it failed", () => {
    const failed = buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1001", manifestVersion: "bmV3" } });
    const { result } = setup({
      dseq: "1001",
      activities: [
        buildActivity({ type: "deployment_close", status: "failed", meta: { dseq: "1001" } }),
        buildActivity({ type: "deployment_update", status: "succeeded", meta: { dseq: "2002" } }),
        failed,
        buildActivity({ type: "deployment_update", status: "succeeded", meta: { dseq: "1001" } })
      ]
    });

    expect(result.current).toBe(failed);
  });

  it.each([
    { case: "succeeded", status: "succeeded" as const },
    { case: "is still being applied", status: "pending" as const }
  ])("finds nothing once a newer update $case", ({ status }) => {
    const { result } = setup({
      dseq: "1001",
      activities: [
        buildActivity({ type: "deployment_update", status, meta: { dseq: "1001" } }),
        buildActivity({ type: "deployment_update", status: "failed", meta: { dseq: "1001" } })
      ]
    });

    expect(result.current).toBeUndefined();
  });

  function setup(input: { dseq: string; activities?: Activity[] }) {
    const dependencies: typeof DEPENDENCIES = {
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: buildUser() }),
      useLatestActivitiesQuery: (() =>
        Object.assign(mock<ReturnType<typeof DEPENDENCIES.useLatestActivitiesQuery>>(), {
          data: input.activities
        })) as typeof DEPENDENCIES.useLatestActivitiesQuery
    };

    return renderHook(() => useFailedDeploymentUpdate(input.dseq, dependencies));
  }
});
