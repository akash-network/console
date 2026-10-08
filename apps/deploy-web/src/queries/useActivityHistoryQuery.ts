import type { paths } from "@akashnetwork/console-api-types";
import { keepPreviousData } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { type Activity, PENDING_ACTIVITY_POLL_MS } from "./useLatestActivitiesQuery";

type ListActivitiesResponse = paths["/v1/activities"]["get"]["responses"][200]["content"]["application/json"];

export const ACTIVITY_HISTORY_PAGE_SIZE = 20;

export type ActivityHistoryFilters = { status?: Activity["status"]; type?: Activity["type"]; cursor?: string };

/** A page of finished entries never changes, so only one with an entry still running is worth checking again. */
export function historyPollIntervalOf(response: ListActivitiesResponse | undefined): number | false {
  return response?.data.activities.some(activity => activity.status === "pending") ? PENDING_ACTIVITY_POLL_MS : false;
}

/** Keeps the page on screen while the next one loads, so paging or filtering doesn't flash the list away. */
export function useActivityHistoryQuery({ status, type, cursor }: ActivityHistoryFilters) {
  const { api } = useServices();

  return api.v1.listActivities.useQuery(
    { limit: ACTIVITY_HISTORY_PAGE_SIZE, ...(status && { status }), ...(type && { type }), ...(cursor && { cursor }) },
    {
      placeholderData: keepPreviousData,
      select: response => ({ activities: response.data.activities, nextCursor: response.data.pagination.nextCursor }),
      refetchInterval: query => historyPollIntervalOf(query.state.data)
    }
  );
}
