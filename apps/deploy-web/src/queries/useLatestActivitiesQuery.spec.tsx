import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import type { ActivityOfAnyType } from "./useLatestActivitiesQuery";
import {
  activityPollIntervalOf,
  IDLE_ACTIVITY_POLL_MS,
  isKnownActivity,
  PENDING_ACTIVITY_POLL_MS,
  useActivityFeedQuery,
  useLatestActivitiesQuery
} from "./useLatestActivitiesQuery";

import { act } from "@testing-library/react";
import { buildActivity, buildActivityOfUnknownType } from "@tests/seeders/activity";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useLatestActivitiesQuery.name, () => {
  it("returns the newest 100 activities of the user", async () => {
    const activities = [buildActivity({ status: "succeeded" }), buildActivity({ status: "failed" })];
    const { result, listActivities } = setup({ activities, enabled: true });

    await vi.waitFor(() => {
      expect(result.current.data).toEqual(activities);
    });
    expect(listActivities).toHaveBeenCalledWith({ limit: 100 });
  });

  it("skips the activities of a type it doesn't know yet", async () => {
    const known = buildActivity({ status: "succeeded" });
    const { result } = setup({ activities: [buildActivityOfUnknownType(), known], enabled: true });

    await vi.waitFor(() => {
      expect(result.current.data).toEqual([known]);
    });
  });

  it("asks for nothing while disabled", async () => {
    const { result, listActivities } = setup({ activities: [], enabled: false });

    await vi.waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(listActivities).not.toHaveBeenCalled();
  });

  it("checks again on its own once the idle interval passes", async () => {
    vi.useFakeTimers();

    try {
      const { listActivities } = setup({ activities: [buildActivity({ status: "succeeded" })], enabled: true });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDLE_ACTIVITY_POLL_MS + 1);
      });

      expect(listActivities).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  describe(useActivityFeedQuery.name, () => {
    it("returns the activities, how many the user has not seen and when the newest was created, from one request", async () => {
      const activities = [buildActivity()];
      const { result, listActivities } = setupFeed({ response: responseOf(activities, 7) });

      await vi.waitFor(() => {
        expect(result.current.data).toEqual({ activities, unseenCount: 7, newestCreatedAt: activities[0].createdAt });
      });
      expect(listActivities).toHaveBeenCalledTimes(1);
      expect(listActivities).toHaveBeenCalledWith({ limit: 100 });
    });

    it("skips the activities of a type it doesn't know yet, yet dates the feed by its newest activity of any type", async () => {
      const unknown = buildActivityOfUnknownType();
      const known = buildActivity();
      const { result } = setupFeed({ response: responseOf([unknown, known], 2) });

      await vi.waitFor(() => {
        expect(result.current.data).toEqual({ activities: [known], unseenCount: 2, newestCreatedAt: unknown.createdAt });
      });
    });

    it("dates an empty feed by nothing", async () => {
      const { result } = setupFeed({ response: responseOf([]) });

      await vi.waitFor(() => {
        expect(result.current.data).toEqual({ activities: [], unseenCount: 0, newestCreatedAt: undefined });
      });
    });

    it("never checks again on its own, leaving the polling to the activity host", async () => {
      vi.useFakeTimers();

      try {
        const { listActivities } = setupFeed({ response: responseOf([buildActivity({ status: "pending" })]) });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(IDLE_ACTIVITY_POLL_MS * 2);
        });

        expect(listActivities).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    function setupFeed(input: { response: ReturnType<typeof responseOf> }) {
      const listActivities = vi.fn().mockResolvedValue(input.response);
      const api = createProxy({ v1: { listActivities } }) as unknown as ApiService;

      const { result } = setupQuery(() => useActivityFeedQuery({ enabled: true }), { services: { api: () => api } });

      return { result, listActivities };
    }
  });

  describe(isKnownActivity.name, () => {
    it("knows a deployment close", () => {
      expect(isKnownActivity(buildActivity({ type: "deployment_close" }))).toBe(true);
    });

    it("doesn't know a type the api added after this bundle was built", () => {
      expect(isKnownActivity(buildActivityOfUnknownType())).toBe(false);
    });

    it("doesn't mistake a type named like a property every object has for a known one", () => {
      expect(isKnownActivity(buildActivityOfUnknownType({ type: "toString" }))).toBe(false);
    });
  });

  describe(activityPollIntervalOf.name, () => {
    it("polls often while an activity is still pending", () => {
      expect(activityPollIntervalOf(responseOf([buildActivity({ status: "succeeded" }), buildActivity({ status: "pending" })]))).toBe(PENDING_ACTIVITY_POLL_MS);
    });

    it("polls less often once nothing is pending", () => {
      expect(activityPollIntervalOf(responseOf([buildActivity({ status: "succeeded" }), buildActivity({ status: "failed" })]))).toBe(IDLE_ACTIVITY_POLL_MS);
    });

    it("polls less often before the first answer", () => {
      expect(activityPollIntervalOf(undefined)).toBe(IDLE_ACTIVITY_POLL_MS);
    });

    it("checks every 5 seconds while pending and every 30 seconds otherwise", () => {
      expect({ PENDING_ACTIVITY_POLL_MS, IDLE_ACTIVITY_POLL_MS }).toEqual({ PENDING_ACTIVITY_POLL_MS: 5_000, IDLE_ACTIVITY_POLL_MS: 30_000 });
    });
  });

  function responseOf<T extends ActivityOfAnyType>(activities: T[], unseenCount = 0) {
    return { data: { activities, unseenCount, pagination: { limit: 50, hasMore: false, nextCursor: null } } };
  }

  function setup(input: { activities: ActivityOfAnyType[]; enabled: boolean }) {
    const listActivities = vi.fn().mockResolvedValue(responseOf(input.activities));
    const api = createProxy({ v1: { listActivities } }) as unknown as ApiService;

    const { result } = setupQuery(() => useLatestActivitiesQuery({ enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { result, listActivities };
  }
});
