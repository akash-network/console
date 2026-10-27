import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./useCreatingDeployments";
import { useCreatingDeployments } from "./useCreatingDeployments";

import { renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useCreatingDeployments.name, () => {
  it("lists a create this tab handed to the api, named as the api named it", () => {
    const { result } = setup({ activities: [create("pending")], oneClickDseqs: ["1000"], names: { "1000": "web" } });

    expect(result.current).toEqual([{ dseq: "1000", name: "web" }]);
  });

  it("lists a create with no name yet as unnamed", () => {
    const { result } = setup({ activities: [create("pending")], oneClickDseqs: ["1000"] });

    expect(result.current).toEqual([{ dseq: "1000", name: null }]);
  });

  it("lists a create whose deployment Console also leases, whichever tab sent it", () => {
    const { result } = setup({ activities: [leaseCreation("pending"), create("pending")] });

    expect(result.current).toEqual([{ dseq: "1000", name: null }]);
  });

  it("leaves out a create the user picks the provider of", () => {
    const { result } = setup({ activities: [create("pending")] });

    expect(result.current).toEqual([]);
  });

  it("keeps a created deployment while Console is still picking its provider", () => {
    const { result } = setup({ activities: [leaseCreation("pending"), create("succeeded")] });

    expect(result.current).toEqual([{ dseq: "1000", name: null }]);
  });

  it.each(["succeeded", "failed"] as const)("drops a created deployment once its lease creation %s", status => {
    const { result } = setup({ activities: [leaseCreation(status), create("succeeded")], oneClickDseqs: ["1000"] });

    expect(result.current).toEqual([]);
  });

  it("drops a created deployment whose lease creation has not shown up", () => {
    const { result } = setup({ activities: [create("succeeded")], oneClickDseqs: ["1000"] });

    expect(result.current).toEqual([]);
  });

  it("drops a create that failed", () => {
    const { result } = setup({ activities: [create("failed")], oneClickDseqs: ["1000"] });

    expect(result.current).toEqual([]);
  });

  it("follows the newest lease creation of the deployment", () => {
    const stillMatching = setup({ activities: [leaseCreation("pending"), leaseCreation("failed"), create("succeeded")] });
    const doneMatching = setup({ activities: [leaseCreation("failed"), leaseCreation("pending"), create("succeeded")] });

    expect(stillMatching.result.current).toEqual([{ dseq: "1000", name: null }]);
    expect(doneMatching.result.current).toEqual([]);
  });

  it("lists each deployment once", () => {
    const { result } = setup({ activities: [create("pending"), create("pending")], oneClickDseqs: ["1000"] });

    expect(result.current).toEqual([{ dseq: "1000", name: null }]);
  });

  it("skips a create that names no deployment", () => {
    const { result } = setup({ activities: [buildActivity({ type: "deployment_create", status: "pending", meta: {} })], oneClickDseqs: ["1000"] });

    expect(result.current).toEqual([]);
  });

  it("reads the feed the activity host polls, and looks up the names of the deployments it is about", () => {
    const { useActivityFeedQuery, useDeploymentNames } = setup({ activities: [create("pending")], oneClickDseqs: ["1000"] });

    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: true });
    expect(useDeploymentNames).toHaveBeenLastCalledWith(["1000"]);
  });

  it.each([
    { case: "the activity center is off", isEnabled: false, isSignedIn: true },
    { case: "no one is signed in", isEnabled: true, isSignedIn: false }
  ])("lists nothing once $case, even from a feed still cached", ({ isEnabled, isSignedIn }) => {
    const { result, useActivityFeedQuery } = setup({ activities: [create("pending")], oneClickDseqs: ["1000"], isEnabled, isSignedIn });

    expect(result.current).toEqual([]);
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  function setup(input: { activities?: Activity[]; oneClickDseqs?: string[]; names?: Record<string, string>; isEnabled?: boolean; isSignedIn?: boolean }) {
    const useActivityFeedQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), {
        data: input.activities && { activities: input.activities, unseenCount: 0, newestCreatedAt: input.activities[0]?.createdAt }
      })) as typeof DEPENDENCIES.useActivityFeedQuery);
    const useDeploymentNames = vi.fn((() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
        getDeploymentName: dseq => input.names?.[String(dseq)] ?? null
      })) as typeof DEPENDENCIES.useDeploymentNames);

    const view = renderHook(() =>
      useCreatingDeployments({
        useFlag: vi.fn((flag: string) => flag === "notifications_activity_center" && (input.isEnabled ?? true)) as typeof DEPENDENCIES.useFlag,
        useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
        useActivityFeedQuery,
        useOneClickDeploys: () => new Map((input.oneClickDseqs ?? []).map(dseq => [dseq, "/new-deployment/configure"])),
        useDeploymentNames
      })
    );

    return { ...view, useActivityFeedQuery, useDeploymentNames };
  }

  function create(status: Activity["status"]): Activity {
    return buildActivity({ type: "deployment_create", status, meta: { dseq: "1000" } });
  }

  function leaseCreation(status: Activity["status"]): Activity {
    return buildActivity({ type: "lease_create", status, meta: { dseq: "1000", providers: [] } });
  }
});
