import { useMemo } from "react";

import type { WorkloadStatus } from "@src/components/deployments/DeploymentDetail/DeploymentPlacements/placementModel";
import type { DeploymentStatusView } from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import { getDeploymentStatus, SPINNING_UP_STATUS } from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery };

const MANIFEST_NOT_DELIVERED = "manifest_not_delivered";

const DEPLOY_FAILED_STATUS: DeploymentStatusView = { label: "Deploy failed", summaryLabel: "Deploy failed", tone: "warning" };

export type DeploymentLaunch = { phase: "awaiting-lease"; providers: string[] } | { phase: "failed"; providers: string[]; hasLease: boolean; reason?: string };

export type ResolvedDeploymentStatus = DeploymentStatusView & { launch?: DeploymentLaunch };

export interface DeploymentActivity {
  isClosing: boolean;
  /** The newest one, as the feed lists newest first, so a retry replaces the attempt it follows. */
  leaseCreation?: Activity;
  isResolving: boolean;
}

/** What the feed the activity host keeps polling says is underway for one deployment, read without adding a poll of its own. */
export function useDeploymentActivity(dseq: string, dependencies: typeof DEPENDENCIES = DEPENDENCIES): DeploymentActivity {
  const isEnabled = dependencies.useFlag("notifications_activity_center");
  const { user } = dependencies.useUser();
  const isFollowingFeed = isEnabled && !!user?.userId;
  const { data, isLoading } = dependencies.useActivityFeedQuery({ enabled: isFollowingFeed });
  const activities = isFollowingFeed ? data?.activities : undefined;

  return useMemo(() => {
    const aboutDeployment = activities?.filter(activity => activity.meta.dseq === dseq) ?? [];

    return {
      isClosing: aboutDeployment.some(activity => activity.type === "deployment_close" && activity.status === "pending"),
      leaseCreation: aboutDeployment.find(activity => activity.type === "lease_create"),
      isResolving: isFollowingFeed && isLoading
    };
  }, [activities, dseq, isFollowingFeed, isLoading]);
}

/** The one status a deployment's card, row and page all show, so none of them can disagree with another. */
export function useDeploymentStatus({
  dseq,
  state,
  leases,
  workload,
  dependencies
}: {
  dseq: string;
  state: string;
  leases: LeaseDto[] | null | undefined;
  workload: WorkloadStatus | undefined;
  dependencies?: typeof DEPENDENCIES;
}): ResolvedDeploymentStatus {
  const { isClosing, leaseCreation } = useDeploymentActivity(dseq, dependencies);

  return useMemo(() => deploymentStatusOf({ state, leases, workload, isClosing, leaseCreation }), [state, leases, workload, isClosing, leaseCreation]);
}

export function deploymentStatusOf(input: {
  state: string;
  leases: LeaseDto[] | null | undefined;
  workload: WorkloadStatus | undefined;
  isClosing: boolean;
  leaseCreation: Activity | undefined;
}): ResolvedDeploymentStatus {
  const status = getDeploymentStatus(input.state, input.leases, input.isClosing, input.workload);
  if (input.isClosing) return status;

  const launch = deploymentLaunchOf(input);
  if (launch?.phase === "failed") return { ...DEPLOY_FAILED_STATUS, launch };
  if (launch || (input.state === "active" && input.leaseCreation?.status === "pending")) return { ...SPINNING_UP_STATUS, launch };

  return status;
}

/** A lease that just landed can still be missing from a lease list read a moment before, so the deployment awaits it until the list shows it. */
export function deploymentLaunchOf({
  state,
  leases,
  leaseCreation
}: {
  state: string;
  leases: LeaseDto[] | null | undefined;
  leaseCreation: Activity | undefined;
}): DeploymentLaunch | undefined {
  if (state !== "active" || !leaseCreation) return undefined;

  const providers = leaseCreation.meta.providers ?? [];
  const { error } = leaseCreation.meta;
  if (leaseCreation.status === "failed") return { phase: "failed", providers, hasLease: error?.code === MANIFEST_NOT_DELIVERED, reason: error?.message };
  if (leases?.some(isLeaseLive)) return undefined;
  if (leaseCreation.status === "pending" || !leases?.length) return { phase: "awaiting-lease", providers };

  return undefined;
}
