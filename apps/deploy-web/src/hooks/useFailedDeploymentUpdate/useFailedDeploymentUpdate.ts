import { DEPENDENCIES, useFollowedActivities } from "@src/hooks/useFollowedActivities/useFollowedActivities";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";

export { DEPENDENCIES };

/** The newest update of the deployment when it failed; the api saves an update before applying it, so the configuration it failed on is the one the console now holds. */
export function useFailedDeploymentUpdate(dseq: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): Activity | undefined {
  const activities = useFollowedActivities(dependencies);
  const newestUpdate = activities?.find(activity => activity.type === "deployment_update" && activity.meta.dseq === dseq);

  return newestUpdate?.status === "failed" ? newestUpdate : undefined;
}
