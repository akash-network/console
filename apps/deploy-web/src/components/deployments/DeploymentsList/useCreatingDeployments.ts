"use client";
import { useMemo } from "react";

import { useDeploymentNames } from "@src/hooks/useDeploymentNames/useDeploymentNames";
import { type OneClickDeploys, useOneClickDeploys } from "@src/hooks/useOneClickDeploys/useOneClickDeploys";
import { useUser } from "@src/hooks/useUser";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";

export const DEPENDENCIES = { useUser, useActivityFeedQuery, useOneClickDeploys, useDeploymentNames };

export interface CreatingDeployment {
  dseq: string;
  name: string | null;
}

/** One-click deploys Console is still creating, read off the feed the activity host polls; the list may lack them until the chain has them and the list is read again. */
export function useCreatingDeployments(dependencies: typeof DEPENDENCIES = DEPENDENCIES): CreatingDeployment[] {
  const { user } = dependencies.useUser();
  const isFollowingFeed = !!user?.userId;
  const { data } = dependencies.useActivityFeedQuery({ enabled: isFollowingFeed });
  const activities = isFollowingFeed ? data?.activities : undefined;
  const oneClickDeploys = dependencies.useOneClickDeploys();
  const { getDeploymentName } = dependencies.useDeploymentNames(activities?.map(activity => activity.meta.dseq) ?? []);

  return useMemo(
    () => creatingDseqsOf(activities ?? [], oneClickDeploys).map(dseq => ({ dseq, name: getDeploymentName(dseq) })),
    [activities, oneClickDeploys, getDeploymentName]
  );
}

/** A create that succeeded stays while its deployment's lease is still underway, so the row does not drop out before the list read again shows it. */
function creatingDseqsOf(activities: Activity[], oneClickDeploys: OneClickDeploys): string[] {
  const newestLeaseCreations = new Map<string, Activity>();
  for (const activity of activities) {
    const { dseq } = activity.meta;
    if (activity.type === "lease_create" && dseq && !newestLeaseCreations.has(dseq)) newestLeaseCreations.set(dseq, activity);
  }

  const dseqs = activities.flatMap(({ type, status, meta: { dseq } }) => {
    if (type !== "deployment_create" || !dseq) return [];

    const leaseCreation = newestLeaseCreations.get(dseq);
    const isOneClick = oneClickDeploys.has(dseq) || !!leaseCreation;
    const isStillCreating = status === "pending" || (status === "succeeded" && leaseCreation?.status === "pending");
    return isOneClick && isStillCreating ? [dseq] : [];
  });

  return [...new Set(dseqs)];
}
