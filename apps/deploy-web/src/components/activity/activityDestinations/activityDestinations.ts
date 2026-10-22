import { deploymentRecoveryOf } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import { ACTIVE_ORGANIZATION_QUERY_PARAM } from "@src/lib/active-organization/active-organization-deep-link";
import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import { appendSearchParams, UrlService } from "@src/utils/urlUtils";

export interface ActivityDestination {
  href: string;
  label: string;
}

const DEPLOYMENT_LIST: ActivityDestination = { href: UrlService.deploymentList(), label: "View deployments" };

/** A create that failed left no deployment behind, so trying again means configuring a new one. */
const NEW_DEPLOYMENT: ActivityDestination = { href: UrlService.configureDeployment(), label: "New deployment" };

/** The feed spans every organization the user is in, so the link opens the deployment in the one the alert is filed in. */
function deploymentAlertDestinationOf({ meta: { dseq, organizationId } }: Activity): ActivityDestination {
  if (!dseq) return DEPLOYMENT_LIST;

  return {
    href: `${UrlService.deploymentDetails(dseq)}${appendSearchParams({ [ACTIVE_ORGANIZATION_QUERY_PARAM]: organizationId })}`,
    label: "View deployment"
  };
}

/** The feed spans every organization the user is in, so the link opens billing in the one the alert is filed in. */
function walletBalanceDestinationOf({ meta: { organizationId } }: Activity): ActivityDestination {
  return { href: `${UrlService.billing()}${appendSearchParams({ [ACTIVE_ORGANIZATION_QUERY_PARAM]: organizationId })}`, label: "View billing" };
}

/** A failed action leads to where the user can try it again, never to a link that tries it again on its own. */
const DESTINATIONS: Record<Activity["type"], (activity: Activity) => ActivityDestination> = {
  deployment_close: ({ status, meta: { dseq } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed") return { href: UrlService.deploymentDetails(dseq, "SETTINGS"), label: "Open settings" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  },
  deployment_create: ({ status, meta: { dseq } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed") return NEW_DEPLOYMENT;

    return { href: UrlService.configureDeployment({ dseq }), label: "Choose a provider" };
  },
  deployment_update: ({ status, meta: { dseq } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed") return { href: UrlService.deploymentDetails(dseq, "UPDATE"), label: "Open update" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  },
  lease_create: ({ status, meta: { dseq, error } }) => {
    if (!dseq) return DEPLOYMENT_LIST;
    if (status === "failed" && deploymentRecoveryOf(error?.code) === "choose-provider")
      return { href: UrlService.configureDeployment({ dseq }), label: "Choose a provider" };

    return { href: UrlService.deploymentDetails(dseq), label: "View deployment" };
  },
  wallet_balance_alert: walletBalanceDestinationOf,
  deployment_closed_alert: deploymentAlertDestinationOf,
  deployment_reclaim_alert: deploymentAlertDestinationOf
};

/** A summary of several deployments, such as a bulk close, leads to the list they all show in. */
export const SUMMARY_DESTINATION = DEPLOYMENT_LIST;

export function activityDestinationOf(activity: Activity): ActivityDestination {
  return DESTINATIONS[activity.type](activity);
}
