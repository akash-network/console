import { DEPENDENCIES, useNewestDeploymentUpdate } from "@src/hooks/useFollowedActivities/useFollowedActivities";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";

export { DEPENDENCIES };

/** The newest update of the deployment when it failed, which leaves the console holding the configuration it failed on. */
export function useFailedDeploymentUpdate(dseq: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): Activity | undefined {
  const newestUpdate = useNewestDeploymentUpdate(dseq, dependencies);

  return newestUpdate?.status === "failed" ? newestUpdate : undefined;
}
