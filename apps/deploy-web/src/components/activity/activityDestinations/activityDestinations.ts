import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export interface ActivityDestination {
  href: string;
  label: string;
}

const DEPLOYMENT_LIST: ActivityDestination = { href: UrlService.deploymentList(), label: "View deployments" };

function alertDestinationOf({ meta: { dseq } }: Activity): ActivityDestination {
  return dseq ? { href: UrlService.deploymentDetails(dseq), label: "View deployment" } : DEPLOYMENT_LIST;
}

/** A failed action leads to where the user can try it again, never to a link that tries it again on its own. */
const DESTINATIONS: Record<Activity["type"], (activity: Activity) => ActivityDestination> = {
  deployment_close: ({ status, meta: { dseq } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed") return { href: UrlService.deploymentDetails(dseq, "SETTINGS"), label: "Open settings" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  },
  deployment_create: ({ meta: { dseq } }) => (dseq ? { href: UrlService.deploymentDetails(dseq), label: "View deployment" } : DEPLOYMENT_LIST),
  deployment_update: ({ status, meta: { dseq } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed") return { href: UrlService.deploymentDetails(dseq, "UPDATE"), label: "Open update" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  },
  lease_create: ({ meta: { dseq } }) => (dseq ? { href: UrlService.deploymentDetails(dseq), label: "View deployment" } : DEPLOYMENT_LIST),
  wallet_balance_alert: alertDestinationOf,
  deployment_closed_alert: alertDestinationOf,
  deployment_reclaim_alert: alertDestinationOf
};

/** A summary of several deployments, such as a bulk close, leads to the list they all show in. */
export const SUMMARY_DESTINATION = DEPLOYMENT_LIST;

export function activityDestinationOf(activity: Activity): ActivityDestination {
  return DESTINATIONS[activity.type](activity);
}
