import { useMemo } from "react";
import type { ConsoleCloseReason } from "@akashnetwork/http-sdk";

import type { WorkloadStatus } from "@src/components/deployments/DeploymentDetail/DeploymentPlacements/placementModel";
import type { DeploymentStatusView } from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import {
  FINDING_PROVIDER_STATUS,
  getDeploymentStatus,
  SPINNING_UP_STATUS,
  STARTING_STATUS
} from "@src/components/deployments/DeploymentDetail/DeploymentStatusBadge";
import { useUser } from "@src/hooks/useUser";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import type { LeaseDto } from "@src/types/deployment";
import { isLeaseLive } from "@src/utils/leaseUtils";

export const DEPENDENCIES = { useUser, useActivityFeedQuery };

export const MANIFEST_NOT_DELIVERED = "manifest_not_delivered";

export const LEASE_CLOSED_BEFORE_MANIFEST = "lease_closed_before_manifest";

/** The user closed a one-click deploy while Console was still picking its provider. */
export const CLOSED_WHILE_MATCHING = "deployment_closed";

/** A one-click deploy closed before Console picked its provider, by Console giving up or by the user, which only a new deployment runs again. */
const CLOSED_BEFORE_MATCH_ERROR_CODES: ReadonlySet<string | undefined> = new Set(["no_provider_bids", "no_reachable_provider", CLOSED_WHILE_MATCHING]);

const DEPLOY_FAILED_STATUS: DeploymentStatusView = { label: "Deploy failed", summaryLabel: "Deploy failed", tone: "warning" };

/** A lease that exists only lacks its manifest, while one its provider closed leaves its group paused, so no provider can bid on the deployment again. */
export type DeploymentRecovery = "send-again" | "choose-provider" | "close" | "deploy-again";

/** Console picks the provider of a one-click deploy itself, and its lease creation names none until it has. */
export type DeploymentLaunchStep = "finding-provider" | "starting" | "awaiting-lease";

export type DeploymentLaunch =
  | { phase: DeploymentLaunchStep; providers: string[] }
  | { phase: "failed"; providers: string[]; recovery: DeploymentRecovery; reason?: string };

export const LAUNCH_STATUSES: Record<DeploymentLaunchStep, DeploymentStatusView> = {
  "finding-provider": FINDING_PROVIDER_STATUS,
  starting: STARTING_STATUS,
  "awaiting-lease": SPINNING_UP_STATUS
};

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
  const { user } = dependencies.useUser();
  const isFollowingFeed = !!user?.userId;
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
  if (launch) return { ...LAUNCH_STATUSES[launch.phase], launch };
  if (!input.isUpdating && input.state === "active" && input.leaseCreation?.status === "pending") return STARTING_STATUS;

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
    return isUpdating ? undefined : { phase: "failed", providers, recovery: deploymentRecoveryOf(error?.code), reason: error?.message };
  }
  if (leases?.some(isLeaseLive)) return undefined;
  if (leaseCreation.status === "pending") return { phase: providers.length > 0 ? "starting" : "finding-provider", providers };
  if (!leases?.length) return { phase: "awaiting-lease", providers };

  return undefined;
}

export function deploymentRecoveryOf(errorCode: string | undefined): DeploymentRecovery {
  if (errorCode === MANIFEST_NOT_DELIVERED) return "send-again";
  if (CLOSED_BEFORE_MATCH_ERROR_CODES.has(errorCode)) return "deploy-again";
  if (errorCode === LEASE_CLOSED_BEFORE_MANIFEST) return "close";

  return "choose-provider";
}
