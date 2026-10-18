import { DEPENDENCIES, useDeploymentsWithPendingActivity } from "@src/hooks/useFollowedActivities/useFollowedActivities";

export { DEPENDENCIES };

/** The dseqs of the user's deployments with an update still being applied in the background, read from the feed the activity host keeps polling. */
export function useUpdatingDeployments(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ReadonlySet<string> {
  return useDeploymentsWithPendingActivity("deployment_update", dependencies);
}
