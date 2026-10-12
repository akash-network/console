import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";

import { buildUser } from "@tests/seeders/user";

export function activityFeedOf(activities: Activity[]): typeof DEPENDENCIES {
  return {
    useFlag: () => true,
    useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: buildUser() }),
    useActivityFeedQuery: () =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), { data: { activities, unseenCount: 0 }, isLoading: false })
  };
}
