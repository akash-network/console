import { MANIFEST_NOT_DELIVERED } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export interface ActivityDestination {
  href: string;
  label: string;
}

const DEPLOYMENT_LIST: ActivityDestination = { href: UrlService.deploymentList(), label: "View deployments" };

/** A failed action leads to where the user can try it again, never to a link that tries it again on its own. */
const DESTINATIONS: Record<Activity["type"], (activity: Activity) => ActivityDestination> = {
  deployment_close: ({ status, meta: { dseq } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed") return { href: UrlService.deploymentDetails(dseq, "SETTINGS"), label: "Open settings" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  },
  lease_create: ({ status, meta: { dseq, error } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed" && error?.code !== MANIFEST_NOT_DELIVERED) return { href: UrlService.configureDeployment({ dseq }), label: "Choose a provider" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  }
};

export function activityDestinationOf(activity: Activity): ActivityDestination {
  return DESTINATIONS[activity.type](activity);
}
