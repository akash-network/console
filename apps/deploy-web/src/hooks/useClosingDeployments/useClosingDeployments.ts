import { useMemo } from "react";

import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useLatestActivitiesQuery } from "@src/queries/useLatestActivitiesQuery";

export const DEPENDENCIES = { useFlag, useUser, useLatestActivitiesQuery };

/** The dseqs of the user's deployments with a close still running in the background, read from the feed the activity host keeps polling. */
export function useClosingDeployments(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ReadonlySet<string> {
  const isEnabled = dependencies.useFlag("notifications_activity_center");
  const { user } = dependencies.useUser();
  const isFollowingFeed = isEnabled && !!user?.userId;
  const { data: activities } = dependencies.useLatestActivitiesQuery({ enabled: isFollowingFeed });

  return useMemo(
    () =>
      new Set(
        isFollowingFeed
          ? activities?.flatMap(activity =>
              activity.type === "deployment_close" && activity.status === "pending" && activity.meta.dseq ? [activity.meta.dseq] : []
            )
          : []
      ),
    [activities, isFollowingFeed]
  );
}
