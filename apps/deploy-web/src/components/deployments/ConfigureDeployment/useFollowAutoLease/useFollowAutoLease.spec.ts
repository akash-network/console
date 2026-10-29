import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";
import { DEPLOY_SUCCESS_DWELL_MS } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./useFollowAutoLease";
import { useFollowAutoLease } from "./useFollowAutoLease";

import { act, renderHook } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(useFollowAutoLease.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("follows nothing while no deploy was handed to the api", () => {
    const { result, useActivityFeedQuery } = setup({ dseq: null, activities: [leaseCreation("succeeded")] });

    expect(result.current).toBeNull();
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("reads the feed the activity host polls once a deploy was handed to the api", () => {
    const { useActivityFeedQuery } = setup({});

    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("reads no feed while no one is signed in", () => {
    const { result, useActivityFeedQuery } = setup({ activities: [leaseCreation("succeeded")], isSignedIn: false });

    expect(result.current).toEqual({ phase: "creating", providers: [] });
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("shows the deployment being created before the feed has loaded", () => {
    const { result } = setup({});

    expect(result.current).toEqual({ phase: "creating", providers: [] });
  });

  it("shows the deployment being created while its create is pending", () => {
    const { result } = setup({ activities: [creation("pending")] });

    expect(result.current).toEqual({ phase: "creating", providers: [] });
  });

  it("moves on to matching once the create succeeded, before Console has opened the match", () => {
    const { result } = setup({ activities: [creation("succeeded")] });

    expect(result.current).toEqual({ phase: "matching", providers: [] });
  });

  it("shows Console matching while its lease creation names no provider", () => {
    const { result } = setup({ activities: [leaseCreation("pending"), creation("succeeded")] });

    expect(result.current).toEqual({ phase: "matching", providers: [] });
  });

  it("shows the lease being prepared with the providers Console picked", () => {
    const { result } = setup({ activities: [leaseCreation("pending", { providers: ["akash1provider"] }), creation("succeeded")] });

    expect(result.current).toEqual({ phase: "preparing", providers: ["akash1provider"] });
  });

  it("reports success once Console leased the deployment", () => {
    const { result } = setup({ activities: [leaseCreation("succeeded", { providers: ["akash1provider"] }), creation("succeeded")] });

    expect(result.current).toEqual({ phase: "success", providers: ["akash1provider"] });
  });

  it("tells why the create failed", () => {
    const { result } = setup({ activities: [creation("failed", { error: { code: "create_failed", message: "Insufficient funds" } })] });

    expect(result.current).toEqual({ phase: "error", providers: [], message: "Insufficient funds" });
  });

  it.each(["no_provider_bids", "no_reachable_provider", "deployment_closed"])("tells why Console gave up on a deployment that is now closed (%s)", code => {
    const error = { code, message: "No provider bid on this deployment in time, so it was closed." };
    const { result } = setup({ activities: [leaseCreation("failed", { error }), creation("succeeded")] });

    expect(result.current).toEqual({ phase: "error", providers: [], message: error.message });
  });

  it("stays on a deployment Console closed after giving up on it", () => {
    vi.useFakeTimers();
    const { replace } = setup({ activities: [leaseCreation("failed", { error: { code: "no_provider_bids", message: "No bids" } }), creation("succeeded")] });

    act(() => vi.runAllTimers());

    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the scene in progress for a failed lease the deployment's own page offers a way back from", () => {
    const error = { code: "lease_not_created", message: "The lease was not created. Choose a provider again." };
    const { result } = setup({ activities: [leaseCreation("failed", { providers: ["akash1provider"], error }), creation("succeeded")] });

    expect(result.current).toEqual({ phase: "preparing", providers: ["akash1provider"] });
  });

  it("lands on the deployment right away when its lease failed in a way its page offers a way back from", () => {
    vi.useFakeTimers();
    const error = { code: "manifest_not_delivered", message: "The manifest was not sent." };
    const { replace } = setup({ activities: [leaseCreation("failed", { providers: ["akash1provider"], error }), creation("succeeded")] });

    act(() => vi.advanceTimersByTime(0));

    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("1000"));
  });

  it("lands on the deployment's events once the finished bar has shown for a beat", () => {
    vi.useFakeTimers();
    const { replace } = setup({ activities: [leaseCreation("succeeded", { providers: ["akash1provider"] }), creation("succeeded")] });

    act(() => vi.advanceTimersByTime(DEPLOY_SUCCESS_DWELL_MS - 1));
    expect(replace).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledWith(UrlService.deploymentDetails("1000", "EVENTS", "events"));
  });

  it("lands nowhere once the page is gone", () => {
    vi.useFakeTimers();
    const { replace, unmount } = setup({ activities: [leaseCreation("succeeded"), creation("succeeded")] });

    unmount();
    act(() => vi.runAllTimers());

    expect(replace).not.toHaveBeenCalled();
  });

  it("lands nowhere while the lease is still underway", () => {
    vi.useFakeTimers();
    const { replace } = setup({ activities: [leaseCreation("pending", { providers: ["akash1provider"] }), creation("succeeded")] });

    act(() => vi.runAllTimers());

    expect(replace).not.toHaveBeenCalled();
  });

  it("reads only the activities about its own deployment", () => {
    const { result } = setup({ activities: [leaseCreation("succeeded", { dseq: "2000" }), creation("failed", { dseq: "2000" })] });

    expect(result.current).toEqual({ phase: "creating", providers: [] });
  });

  it("follows the newest lease creation of the deployment", () => {
    const { result } = setup({
      activities: [leaseCreation("pending"), leaseCreation("failed", { error: { code: "no_provider_bids", message: "No bids" } }), creation("succeeded")]
    });

    expect(result.current).toEqual({ phase: "matching", providers: [] });
  });

  it("takes the pending create and lease creation off the activity host, so their outcomes show here only", () => {
    const create = creation("pending");
    const lease = leaseCreation("pending");
    const { followUntilSettled, showFeed } = setup({ activities: [create] });

    showFeed([lease, { ...create, status: "succeeded" }]);

    expect(followUntilSettled.mock.calls).toEqual([[create.id], [lease.id]]);
  });

  it("takes each activity off the activity host once", () => {
    const lease = leaseCreation("pending");
    const { followUntilSettled, showFeed } = setup({ activities: [lease, creation("succeeded")] });

    showFeed([{ ...lease, meta: { dseq: "1000", providers: ["akash1provider"] } }, creation("succeeded")]);

    expect(followUntilSettled).toHaveBeenCalledTimes(1);
  });

  it("leaves an activity that already settled to the activity host", () => {
    const { followUntilSettled } = setup({ activities: [leaseCreation("succeeded"), creation("succeeded")] });

    expect(followUntilSettled).not.toHaveBeenCalled();
  });

  it("hands what it followed back to the activity host when the page goes", () => {
    const create = creation("pending");
    const lease = leaseCreation("pending");
    const { stopFollowing, showFeed, unmount } = setup({ activities: [create] });
    showFeed([lease, { ...create, status: "succeeded" }]);

    unmount();

    expect(stopFollowing.mock.calls).toEqual([[create.id], [lease.id]]);
  });

  it("keeps following while the page stays", () => {
    const { stopFollowing, showFeed } = setup({ activities: [creation("pending")] });

    showFeed([leaseCreation("pending"), creation("succeeded")]);

    expect(stopFollowing).not.toHaveBeenCalled();
  });

  function setup(input: { dseq?: string | null; activities?: Activity[]; isSignedIn?: boolean }) {
    let activities = input.activities;
    const replace = vi.fn();
    const followUntilSettled = vi.fn();
    const stopFollowing = vi.fn();
    const router = mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ replace });
    const user = mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() });
    const outcomes = mock<ReturnType<typeof DEPENDENCIES.useMarkActivityOutcomes>>({ followUntilSettled, stopFollowing });
    const useActivityFeedQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), {
        data: activities && { activities, unseenCount: 0, newestCreatedAt: activities[0]?.createdAt }
      })) as typeof DEPENDENCIES.useActivityFeedQuery);

    const view = renderHook(() =>
      useFollowAutoLease(input.dseq === undefined ? "1000" : input.dseq, {
        useRouter: () => router,
        useUser: () => user,
        useActivityFeedQuery,
        useMarkActivityOutcomes: () => outcomes
      })
    );

    function showFeed(nextActivities: Activity[]) {
      activities = nextActivities;
      view.rerender();
    }

    return { ...view, showFeed, replace, followUntilSettled, stopFollowing, useActivityFeedQuery };
  }

  function creation(status: Activity["status"], meta: Partial<Activity["meta"]> = {}): Activity {
    return buildActivity({ type: "deployment_create", status, meta: { dseq: "1000", ...meta } });
  }

  function leaseCreation(status: Activity["status"], meta: Partial<Activity["meta"]> = {}): Activity {
    return buildActivity({ type: "lease_create", status, meta: { dseq: "1000", providers: [], ...meta } });
  }
});
