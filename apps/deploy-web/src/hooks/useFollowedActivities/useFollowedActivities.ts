import { useMemo } from "react";

import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { type Activity, useLatestActivitiesQuery } from "@src/queries/useLatestActivitiesQuery";

export const DEPENDENCIES = { useFlag, useUser, useLatestActivitiesQuery };

/** The feed the activity host keeps polling, read only while the activity center is on for a signed-in user, so activities still cached from before count for nothing. */
export function useFollowedActivities(dependencies: typeof DEPENDENCIES = DEPENDENCIES): Activity[] | undefined {
  const isEnabled = dependencies.useFlag("notifications_activity_center");
  const { user } = dependencies.useUser();
  const isFollowingFeed = isEnabled && !!user?.userId;
  const { data: activities } = dependencies.useLatestActivitiesQuery({ enabled: isFollowingFeed });

  return isFollowingFeed ? activities : undefined;
}

/** The dseqs of the user's deployments with an action of this type still running in the background. */
export function useDeploymentsWithPendingActivity(type: Activity["type"], dependencies: typeof DEPENDENCIES = DEPENDENCIES): ReadonlySet<string> {
  const activities = useFollowedActivities(dependencies);

  return useMemo(
    () => new Set(activities?.flatMap(activity => (activity.type === type && activity.status === "pending" && activity.meta.dseq ? [activity.meta.dseq] : []))),
    [activities, type]
  );
}
