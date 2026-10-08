import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";

type ListActivitiesResponse = paths["/v1/activities"]["get"]["responses"][200]["content"]["application/json"];

export type Activity = ListActivitiesResponse["data"]["activities"][number];

export const PENDING_ACTIVITY_POLL_MS = 5_000;

export const IDLE_ACTIVITY_POLL_MS = 30_000;

/** The api's maximum, so a bulk close of the largest page the deployments list offers (50) still fits beside as many newer actions. */
const LATEST_ACTIVITIES_LIMIT = 100;

export function activityPollIntervalOf(response: ListActivitiesResponse | undefined): number {
  return response?.data.activities.some(activity => activity.status === "pending") ? PENDING_ACTIVITY_POLL_MS : IDLE_ACTIVITY_POLL_MS;
}

export function useLatestActivitiesQuery(options: { enabled: boolean }) {
  return useLatestActivitiesResponse(options, response => response.data.activities, { polls: true });
}

/** Every observer polls on its own timer, so a reader of the feed the activity host already polls must not add one. */
export function useActivityFeedQuery(options: { enabled: boolean }) {
  return useLatestActivitiesResponse(options, response => ({ activities: response.data.activities, unseenCount: response.data.unseenCount }), { polls: false });
}

/** React Query pauses interval refetches while the tab is hidden, so a background tab stops checking until it is shown again. */
function useLatestActivitiesResponse<T>(options: { enabled: boolean }, select: (response: ListActivitiesResponse) => T, { polls }: { polls: boolean }) {
  const { api } = useServices();

  return api.v1.listActivities.useQuery(
    { limit: LATEST_ACTIVITIES_LIMIT },
    {
      enabled: options.enabled,
      select,
      refetchInterval: polls ? query => activityPollIntervalOf(query.state.data) : false
    }
  );
}
