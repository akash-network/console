import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import upperFirst from "lodash/upperFirst";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { deploymentLabelOf } from "@src/components/activity/activityLabels/activityLabels";
import { ActivityToast } from "@src/components/activity/ActivityToast/ActivityToast";
import { useDeploymentsReadiness } from "@src/hooks/useDeploymentsReadiness/useDeploymentsReadiness";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { type Activity, useActivityFeedQuery } from "@src/queries/useLatestActivitiesQuery";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, useUser, useActivityFeedQuery, useDeploymentsReadiness, useSnackbar, useQueryClient, useRouter };

/** A deploy that went through this long ago is left to the deployment's own page, so a feed of old deploys never fans out into checks on each. */
const READY_WATCH_WINDOW_MS = 30 * 60 * 1000;

type Deploy = Activity & { meta: { dseq: string } };

/**
 * Tells the user when a deployment they deployed has every service ready, wherever they are in the app. Only a deploy
 * seen underway, or one that showed up after the feed first loaded, gets the news, so one already running is never announced.
 */
export function DeploymentReadyHost({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES }) {
  const isEnabled = d.useFlag("notifications_activity_center");
  const { user } = d.useUser();
  const isFollowingFeed = isEnabled && !!user?.userId;
  const { data: feed } = d.useActivityFeedQuery({ enabled: isFollowingFeed });
  const activities = isFollowingFeed ? feed?.activities : undefined;
  const [settledDeployIds, setSettledDeployIds] = useState<ReadonlySet<string>>(() => new Set());
  const watchedDeploys = useMemo(
    () => newestDeploysOf(activities ?? []).filter(deploy => isWithinWatch(deploy) && !settledDeployIds.has(deploy.id)),
    [activities, settledDeployIds]
  );
  const launches = d.useDeploymentsReadiness(watchedDeploys.map(deploy => deploy.meta.dseq));
  const activityIdsAtFirstRead = useRef<ReadonlySet<string>>();
  const spinningUpDeployIds = useRef(new Set<string>());
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const queryClient = d.useQueryClient();
  const router = d.useRouter();

  useEffect(
    function noteDeploysSeenUnderway() {
      if (!activities) return;

      const atFirstRead = (activityIdsAtFirstRead.current ??= new Set(activities.map(({ id }) => id)));
      for (const deploy of watchedDeploys) {
        if (deploy.status === "pending" || !atFirstRead.has(deploy.id)) spinningUpDeployIds.current.add(deploy.id);
      }
    },
    [activities, watchedDeploys]
  );

  useEffect(
    function announceDeploymentsThatBecameReady() {
      const deploysByDseq = new Map(watchedDeploys.map(deploy => [deploy.meta.dseq, deploy]));
      const settledIds: string[] = [];

      for (const { dseq, name, readiness } of launches) {
        const deploy = deploysByDseq.get(dseq);
        if (!deploy) continue;

        if (readiness === "starting") spinningUpDeployIds.current.add(deploy.id);
        if (readiness === "ready" && spinningUpDeployIds.current.has(deploy.id)) announceReady(dseq, name);
        if (readiness === "ready" || readiness === "stopped" || !isWithinWatch(deploy)) settledIds.push(deploy.id);
      }

      if (settledIds.length > 0) setSettledDeployIds(current => new Set([...current, ...settledIds]));

      function announceReady(dseq: string, name: string | null) {
        queryClient.invalidateQueries({ queryKey: QueryKeys.getDeploymentLeaseStatusesKey(dseq) });
        const key = enqueueSnackbar(
          <ActivityToast
            title={`${upperFirst(deploymentLabelOf(name, dseq))} is ready`}
            subTitle="Its services are up and running."
            iconVariant="success"
            actionLabel="View deployment"
            onAction={() => {
              router.push(UrlService.deploymentDetails(dseq));
              closeSnackbar(key);
            }}
          />,
          { variant: "success" }
        );
      }
    },
    [launches, watchedDeploys, enqueueSnackbar, closeSnackbar, queryClient, router]
  );

  return null;
}

/** The newest deploy of each deployment decides, as the feed lists newest first, so a retry replaces the attempt before it. */
function newestDeploysOf(activities: Activity[]): Deploy[] {
  const newestDeploys = new Map<string, Deploy>();
  for (const activity of activities) {
    if (isDeploy(activity) && !newestDeploys.has(activity.meta.dseq)) newestDeploys.set(activity.meta.dseq, activity);
  }

  return [...newestDeploys.values()];
}

function isDeploy(activity: Activity): activity is Deploy {
  return activity.type === "lease_create" && !!activity.meta.dseq;
}

/** Read on every check rather than only when the feed changes, since an idle feed keeps the same data while the window runs out. */
function isWithinWatch({ status, updatedAt }: Deploy): boolean {
  return status === "pending" || (status === "succeeded" && Date.now() - Date.parse(updatedAt) < READY_WATCH_WINDOW_MS);
}
