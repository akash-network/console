import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import {
  activityPollIntervalOf,
  IDLE_ACTIVITY_POLL_MS,
  PENDING_ACTIVITY_POLL_MS,
  useActivityFeedQuery,
  useLatestActivitiesQuery
} from "./useLatestActivitiesQuery";

import { act } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
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
    it("returns the activities and how many the user has not seen, from one request", async () => {
      const activities = [buildActivity()];
      const { result, listActivities } = setupFeed({ response: responseOf(activities, 7) });

      await vi.waitFor(() => {
        expect(result.current.data).toEqual({ activities, unseenCount: 7 });
      });
      expect(listActivities).toHaveBeenCalledTimes(1);
      expect(listActivities).toHaveBeenCalledWith({ limit: 100 });
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

  function responseOf(activities: ReturnType<typeof buildActivity>[], unseenCount = 0) {
    return { data: { activities, unseenCount, pagination: { limit: 50, hasMore: false, nextCursor: null } } };
  }

  function setup(input: { activities: ReturnType<typeof buildActivity>[]; enabled: boolean }) {
    const listActivities = vi.fn().mockResolvedValue(responseOf(input.activities));
    const api = createProxy({ v1: { listActivities } }) as unknown as ApiService;

    const { result } = setupQuery(() => useLatestActivitiesQuery({ enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { result, listActivities };
  }
});
