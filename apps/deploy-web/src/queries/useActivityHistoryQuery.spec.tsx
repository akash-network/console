import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { ACTIVITY_HISTORY_PAGE_SIZE, historyPollIntervalOf, useActivityHistoryQuery } from "./useActivityHistoryQuery";
import { PENDING_ACTIVITY_POLL_MS } from "./useLatestActivitiesQuery";

import { buildActivity } from "@tests/seeders/activity";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useActivityHistoryQuery.name, () => {
  it("asks for one page of the user's activity, newest first", async () => {
    const activities = [buildActivity({ status: "succeeded" }), buildActivity({ status: "failed" })];
    const { result, listActivities } = setup({ activities, nextCursor: "cursor-2" });

    await vi.waitFor(() => {
      expect(result.current.data).toEqual({ activities, nextCursor: "cursor-2" });
    });
    expect(listActivities).toHaveBeenCalledWith({ limit: ACTIVITY_HISTORY_PAGE_SIZE });
  });

  it("passes the filters and the cursor of the page it asks for", async () => {
    const { result, listActivities } = setup({ activities: [], filters: { status: "failed", type: "deployment_close", cursor: "cursor-2" } });

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(listActivities).toHaveBeenCalledWith({ limit: ACTIVITY_HISTORY_PAGE_SIZE, status: "failed", type: "deployment_close", cursor: "cursor-2" });
  });

  it("reads 20 entries a page", () => {
    expect(ACTIVITY_HISTORY_PAGE_SIZE).toBe(20);
  });

  describe(historyPollIntervalOf.name, () => {
    it("polls while an entry on the page is still running", () => {
      expect(historyPollIntervalOf(responseOf([buildActivity({ status: "succeeded" }), buildActivity({ status: "pending" })], null))).toBe(
        PENDING_ACTIVITY_POLL_MS
      );
    });

    it("stops polling once nothing on the page is running", () => {
      expect(historyPollIntervalOf(responseOf([buildActivity({ status: "failed" })], null))).toBe(false);
    });

    it("does not poll before the first answer", () => {
      expect(historyPollIntervalOf(undefined)).toBe(false);
    });
  });

  function responseOf(activities: ReturnType<typeof buildActivity>[], nextCursor: string | null) {
    return { data: { activities, unseenCount: 0, pagination: { limit: ACTIVITY_HISTORY_PAGE_SIZE, hasMore: nextCursor !== null, nextCursor } } };
  }

  function setup(input: {
    activities: ReturnType<typeof buildActivity>[];
    nextCursor?: string | null;
    filters?: Parameters<typeof useActivityHistoryQuery>[0];
  }) {
    const listActivities = vi.fn().mockResolvedValue(responseOf(input.activities, input.nextCursor ?? null));
    const api = createProxy({ v1: { listActivities } }) as unknown as ApiService;

    const { result } = setupQuery(() => useActivityHistoryQuery(input.filters ?? {}), {
      services: { api: () => api }
    });

    return { result, listActivities };
  }
});
