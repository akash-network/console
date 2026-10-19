import { useMemo } from "react";
import type { ConsoleCloseReason } from "@akashnetwork/http-sdk";

import type { WorkloadStatus } from "@src/components/deployments/DeploymentDetail/DeploymentPlacements/placementModel";
import type { DeploymentStatusView } from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import { getDeploymentStatus, SPINNING_UP_STATUS } from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery };

export const MANIFEST_NOT_DELIVERED = "manifest_not_delivered";

const DEPLOY_FAILED_STATUS: DeploymentStatusView = { label: "Deploy failed", summaryLabel: "Deploy failed", tone: "warning" };

export type DeploymentLaunch = { phase: "awaiting-lease"; providers: string[] } | { phase: "failed"; providers: string[]; hasLease: boolean; reason?: string };

export type ResolvedDeploymentStatus = DeploymentStatusView & { launch?: DeploymentLaunch };

export interface DeploymentActivity {
  isClosing: boolean;
  isUpdating: boolean;
  /** The newest one, as the feed lists newest first, so a retry replaces the attempt it follows. */
  leaseCreation?: Activity;
  /** Until the feed is read again after mounting, since a cached read can predate a lease that was just requested. */
  isResolving: boolean;
}

/** What the feed the activity host keeps polling says is underway for one deployment, read without adding a poll of its own. */
export function useDeploymentActivity(dseq: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): DeploymentActivity {
  const isEnabled = dependencies.useFlag("notifications_activity_center");
  const { user } = dependencies.useUser();
  const isFollowingFeed = isEnabled && !!user?.userId;
  const { data, isFetchedAfterMount } = dependencies.useActivityFeedQuery({ enabled: isFollowingFeed });
  const activities = isFollowingFeed ? data?.activities : undefined;

  return useMemo(() => {
    const aboutDeployment = activities?.filter(activity => activity.meta.dseq === dseq) ?? [];

    return {
      isClosing: aboutDeployment.some(activity => isPending(activity, "deployment_close")),
      isUpdating: aboutDeployment.some(activity => isPending(activity, "deployment_update")),
      leaseCreation: standingLeaseCreationOf(aboutDeployment),
      isResolving: isFollowingFeed && !isFetchedAfterMount
    };
  }, [activities, dseq, isFollowingFeed, isFetchedAfterMount]);
}

function isPending(activity: Activity, type: Activity["type"]): boolean {
  return activity.type === type && activity.status === "pending";
}

/** An update that succeeded after the provider refused the lease's manifest has sent that manifest again, so the refusal no longer stands. */
function standingLeaseCreationOf(aboutDeployment: Activity[]): Activity | undefined {
  const index = aboutDeployment.findIndex(activity => activity.type === "lease_create");
  const leaseCreation: Activity | undefined = aboutDeployment[index];
  if (!leaseCreation || leaseCreation.status !== "failed" || leaseCreation.meta.error?.code !== MANIFEST_NOT_DELIVERED) return leaseCreation;

  const isDeliveredSince = aboutDeployment.slice(0, index).some(activity => activity.type === "deployment_update" && activity.status === "succeeded");
  return isDeliveredSince ? undefined : leaseCreation;
}

/** The one status a deployment's card, row and page all show, except that only the page loads the settings that say Console closed it. */
export function useDeploymentStatus({
  dseq,
  state,
  leases,
  workload,
  consoleCloseReason,
  dependencies
}: {
  dseq: string;
  state: string;
  leases: LeaseDto[] | null | undefined;
  workload: WorkloadStatus | undefined;
  consoleCloseReason?: ConsoleCloseReason | null;
  dependencies?: typeof DEPENDENCIES;
}): ResolvedDeploymentStatus {
  const { isClosing, isUpdating, leaseCreation } = useDeploymentActivity(dseq, dependencies);

  return useMemo(
    () => deploymentStatusOf({ state, leases, workload, isClosing, isUpdating, leaseCreation, consoleCloseReason }),
    [state, leases, workload, isClosing, isUpdating, leaseCreation, consoleCloseReason]
  );
}

/** A deployment still waiting for its lease reads as spinning up even while an update applies, since no provider runs anything an update could change yet. */
export function deploymentStatusOf(input: {
  state: string;
  leases: LeaseDto[] | null | undefined;
  workload: WorkloadStatus | undefined;
  isClosing: boolean;
  isUpdating: boolean;
  leaseCreation: Activity | undefined;
  consoleCloseReason?: ConsoleCloseReason | null;
}): ResolvedDeploymentStatus {
  const status = getDeploymentStatus(input.state, input.leases, input.isClosing, input.workload, input.isUpdating, input.consoleCloseReason);
  if (input.isClosing) return status;

  const launch = deploymentLaunchOf(input);
  if (launch?.phase === "failed") return { ...DEPLOY_FAILED_STATUS, launch };
  if (launch) return { ...SPINNING_UP_STATUS, launch };
  if (!input.isUpdating && input.state === "active" && input.leaseCreation?.status === "pending") return SPINNING_UP_STATUS;

  return status;
}

/** A lease that just landed can still be missing from a lease list read a moment before, so the deployment awaits it until the list shows it. */
export function deploymentLaunchOf({
  state,
  leases,
  leaseCreation,
  isUpdating
}: {
  state: string;
  leases: LeaseDto[] | null | undefined;
  leaseCreation: Activity | undefined;
  /** An update sends the manifest again, so a failed launch waits for its outcome before offering another way back. */
  isUpdating: boolean;
}): DeploymentLaunch | undefined {
  if (state !== "active" || !leaseCreation) return undefined;

  const providers = leaseCreation.meta.providers ?? [];
  const { error } = leaseCreation.meta;
  if (leaseCreation.status === "failed") {
    return isUpdating ? undefined : { phase: "failed", providers, hasLease: error?.code === MANIFEST_NOT_DELIVERED, reason: error?.message };
  }
  if (leases?.some(isLeaseLive)) return undefined;
  if (leaseCreation.status === "pending" || !leases?.length) return { phase: "awaiting-lease", providers };

  return undefined;
}
