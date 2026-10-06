import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";

type ListActivitiesResponse = paths["/v1/activities"]["get"]["responses"][200]["content"]["application/json"];

export type Activity = ListActivitiesResponse["data"]["activities"][number];

export const PENDING_ACTIVITY_POLL_MS = 5_000;

export const IDLE_ACTIVITY_POLL_MS = 30_000;

/** Deep enough that an action started together with many others is still on the page when it finishes. */
const LATEST_ACTIVITIES_LIMIT = 50;

export function activityPollIntervalOf(response: ListActivitiesResponse | undefined): number {
  return response?.data.activities.some(activity => activity.status === "pending") ? PENDING_ACTIVITY_POLL_MS : IDLE_ACTIVITY_POLL_MS;
}

/** React Query pauses interval refetches while the tab is hidden, so a background tab stops checking until it is shown again. */
export function useLatestActivitiesQuery(options: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.listActivities.useQuery(
    { limit: LATEST_ACTIVITIES_LIMIT },
    {
      enabled: options.enabled,
      select: response => response.data.activities,
      refetchInterval: query => activityPollIntervalOf(query.state.data)
    }
  );
}
