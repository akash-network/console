import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import type { DeployPhaseId } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { deploymentRecoveryOf } from "@src/hooks/useDeploymentStatus/useDeploymentStatus";
import { useMarkActivityOutcomes } from "@src/hooks/useHandledActivityOutcomes/useHandledActivityOutcomes";
import { useUser } from "@src/hooks/useUser";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";
import { DEPLOY_SUCCESS_DWELL_MS } from "../useDeploymentFlow/useDeploymentFlow";

export const DEPENDENCIES = { useUser, useActivityFeedQuery, useMarkActivityOutcomes, useRouter };

export type AutoLeaseProgress = { phase: DeployPhaseId | "success"; providers: string[] } | { phase: "error"; providers: string[]; message?: string };

type Landing = { href: string; delayMs: number };

/** Reads the feed the activity host already polls, and takes the outcomes it shows off the host so a failure is not told twice. */
export function useFollowAutoLease(dseq: string | null, dependencies: typeof DEPENDENCIES = DEPENDENCIES): AutoLeaseProgress | null {
  const router = dependencies.useRouter();
  const { user } = dependencies.useUser();
  const isFollowing = !!dseq && !!user?.userId;
  const { data } = dependencies.useActivityFeedQuery({ enabled: isFollowing });
  const { followUntilSettled, stopFollowing } = dependencies.useMarkActivityOutcomes();
  const followedIdsRef = useRef(new Set<string>());

  const activities = isFollowing ? data?.activities : undefined;
  const creation = activities?.find(activity => activity.type === "deployment_create" && activity.meta.dseq === dseq);
  const leaseCreation = activities?.find(activity => activity.type === "lease_create" && activity.meta.dseq === dseq);
  const pendingCreationId = creation?.status === "pending" ? creation.id : undefined;
  const pendingLeaseCreationId = leaseCreation?.status === "pending" ? leaseCreation.id : undefined;
  const landing = dseq && leaseCreation ? landingOf(dseq, leaseCreation) : undefined;
  const landingHref = landing?.href;
  const landingDelayMs = landing?.delayMs;

  useEffect(
    function showOutcomesHereRatherThanInAToast() {
      for (const activityId of [pendingCreationId, pendingLeaseCreationId]) {
        if (!activityId || followedIdsRef.current.has(activityId)) continue;
        followedIdsRef.current.add(activityId);
        followUntilSettled(activityId);
      }
    },
    [pendingCreationId, pendingLeaseCreationId, followUntilSettled]
  );

  useEffect(
    function handUnsettledOutcomesBackToTheHost() {
      const followedIds = followedIdsRef.current;
      return function stopFollowingOnLeave() {
        for (const activityId of followedIds) stopFollowing(activityId);
      };
    },
    [stopFollowing]
  );

  useEffect(
    function landOnTheDeployment() {
      if (!landingHref) return;
      const timer = setTimeout(() => router.replace(landingHref), landingDelayMs);
      return function cancelLanding() {
        clearTimeout(timer);
      };
    },
    [landingHref, landingDelayMs, router]
  );

  return dseq ? autoLeaseProgressOf(creation, leaseCreation) : null;
}

function autoLeaseProgressOf(creation: Activity | undefined, leaseCreation: Activity | undefined): AutoLeaseProgress {
  if (leaseCreation) return leaseProgressOf(leaseCreation);
  if (creation?.status === "failed") return { phase: "error", providers: [], message: creation.meta.error?.message };
  return { phase: creation?.status === "succeeded" ? "matching" : "creating", providers: [] };
}

/** A failure the deployment's own page offers a way back from keeps the scene in progress while that page loads. */
function leaseProgressOf({ status, meta }: Activity): AutoLeaseProgress {
  const providers = meta.providers ?? [];
  if (status === "succeeded") return { phase: "success", providers };
  if (status === "failed" && isDeploymentGone(meta.error?.code)) return { phase: "error", providers, message: meta.error?.message };
  return { phase: providers.length > 0 ? "preparing" : "matching", providers };
}

function landingOf(dseq: string, { status, meta }: Activity): Landing | undefined {
  if (status === "succeeded") return { href: UrlService.deploymentDetails(dseq, "EVENTS", "events"), delayMs: DEPLOY_SUCCESS_DWELL_MS };
  if (status === "failed" && !isDeploymentGone(meta.error?.code)) return { href: UrlService.deploymentDetails(dseq), delayMs: 0 };
  return undefined;
}

/** Console closes a deployment it found no provider for, so only a new deployment runs it again. */
function isDeploymentGone(errorCode: string | undefined): boolean {
  return deploymentRecoveryOf(errorCode) === "deploy-again";
}
