import { DEPENDENCIES, useDeploymentsWithPendingActivity } from "@src/hooks/useFollowedActivities/useFollowedActivities";

export { DEPENDENCIES };

/** The dseqs of the user's deployments with a close still running in the background, read from the feed the activity host keeps polling. */
export function useClosingDeployments(dependencies: typeof DEPENDENCIES = DEPENDENCIES): ReadonlySet<string> {
  return useDeploymentsWithPendingActivity("deployment_close", dependencies);
}
